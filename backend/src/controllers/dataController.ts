import { Request, Response } from 'express';
import { Op } from 'sequelize';
import {
  User,
  Policy,
  Memo,
  PdfDocument,
  Acknowledgement,
  AuditLog,
  RolePermissions,
  TelegramBotSettings,
} from '../models';
import { buildPdfKey, uploadPdf, deletePdfObject } from '../services/s3';
import { encryptPassword } from '../utils/passwordCrypto';

const DEFAULT_IMPORT_PASSWORD = 'password123';

export const getDataHealth = async (req: any, res: Response): Promise<void> => {
  try {
    const [users, policies, memos, pdfs, acks, auditLogs, permissions, botSettings] = await Promise.all([
      User.count(),
      Policy.count(),
      Memo.count(),
      PdfDocument.count(),
      Acknowledgement.count(),
      AuditLog.count(),
      RolePermissions.count(),
      TelegramBotSettings.count(),
    ]);

    res.json({
      success: true,
      counts: { users, policies, memos, pdfs, acks, auditLogs, permissions, botSettings },
    });
  } catch (error) {
    console.error('getDataHealth error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const importDataset = async (req: any, res: Response): Promise<void> => {
  try {
    const { users = [], policies = [], memos = [], pdfs = [], acks = [], auditLogs = [], mode = 'merge' } = req.body || {};

    if (!Array.isArray(users) || !Array.isArray(policies) || !Array.isArray(memos) || !Array.isArray(pdfs) || !Array.isArray(acks) || !Array.isArray(auditLogs)) {
      res.status(400).json({ success: false, message: 'Expected arrays for users, policies, memos, pdfs, acks, auditLogs' });
      return;
    }

    if (mode === 'replace') {
      await Promise.all([
        Acknowledgement.destroy({ where: {}, truncate: true }),
        AuditLog.destroy({ where: {}, truncate: true }),
        Memo.destroy({ where: {}, truncate: true }),
        Policy.destroy({ where: {}, truncate: true }),
        PdfDocument.destroy({ where: {}, truncate: true }),
        User.destroy({ where: {}, truncate: true }),
      ]);
    }

    const defaultHash = encryptPassword(DEFAULT_IMPORT_PASSWORD);

    let usersCreated = 0;
    for (const u of users) {
      const email = String(u.email || '').toLowerCase();
      if (!email) continue;
      const username = typeof u.username === 'string' && u.username.trim() ? u.username.trim().replace(/^@/, '') : null;
      const [row, created] = await User.findOrCreate({
        where: { email },
        defaults: {
          id: u.id || `USR-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: u.name || 'Unnamed User',
          role: ['admin', 'hr', 'manager', 'staff'].includes(u.role) ? u.role : 'staff',
          department: u.department || 'General',
          jobTitle: u.jobTitle || 'Staff',
          email,
          username,
          password: defaultHash,
          telegramHandle: u.telegramHandle || '',
          avatar: u.avatar || '',
          status: u.status === 'suspended' ? 'suspended' : 'active',
          credentialType: u.credentialType || 'Staff',
          lastLogin: u.lastLogin || new Date().toISOString(),
          assignedDepartments: u.assignedDepartments || null,
        } as any,
      });
      if (!created && row) {
        await row.update({ password: defaultHash });
      }
      if (created) usersCreated++;
    }

    for (const p of policies) {
      await Policy.findOrCreate({ where: { id: p.id }, defaults: { ...p, lastUpdated: p.lastUpdated || new Date().toISOString().split('T')[0] } as any });
    }

    for (const m of memos) {
      await Memo.findOrCreate({ where: { id: m.id }, defaults: m as any });
    }

    let pdfsUploaded = 0;
    let pdfsWithoutFile = 0;
    for (const d of pdfs) {
      const existing = await PdfDocument.findByPk(d.id);
      if (existing) continue;
      // Legacy base64 payloads get pushed to S3 so imports don't re-inflate the table.
      const { fileDataUrl, ...rest } = d;
      if (typeof fileDataUrl === 'string' && fileDataUrl.startsWith('data:application/pdf;base64,')) {
        const key = buildPdfKey();
        const bytes = Buffer.from(fileDataUrl.slice('data:application/pdf;base64,'.length), 'base64');
        try {
          await uploadPdf(key, bytes, 'application/pdf');
          await PdfDocument.create({ ...rest, s3Key: key, fileDataUrl: null } as any);
          pdfsUploaded++;
        } catch (uploadError) {
          console.error(`importDataset: S3 upload failed for ${d.id}, storing without file`, uploadError);
          await PdfDocument.create({ ...rest, s3Key: null } as any);
          pdfsWithoutFile++;
        }
      } else {
        await PdfDocument.create({ ...rest, s3Key: null } as any);
        pdfsWithoutFile++;
      }
    }

    for (const a of acks) {
      await Acknowledgement.findOrCreate({ where: { id: a.id }, defaults: a as any });
    }

    for (const l of auditLogs) {
      await AuditLog.findOrCreate({ where: { id: l.id }, defaults: l as any });
    }

    const summary = {
      users: users.length,
      usersCreated,
      policies: policies.length,
      memos: memos.length,
      pdfs: pdfs.length,
      acks: acks.length,
      auditLogs: auditLogs.length,
      pdfsUploaded,
      pdfsWithoutFile,
      mode,
      defaultPassword: DEFAULT_IMPORT_PASSWORD,
    };

    res.json({ success: true, imported: summary });
  } catch (error) {
    console.error('importDataset error:', error);
    res.status(500).json({ success: false, message: error instanceof Error ? error.message : 'Internal server error' });
  }
};

export const resetWorkspace = async (req: any, res: Response): Promise<void> => {
  try {
    // Capture keys before truncating so the reset also clears S3 objects.
    const existingKeys = await PdfDocument.findAll({
      attributes: ['s3Key'],
      where: { s3Key: { [Op.ne]: null } },
    } as any);
    const keysToClean = existingKeys
      .map((row: any) => row.s3Key as string)
      .filter((key: string) => typeof key === 'string' && key.length > 0);

    await Promise.all([
      Acknowledgement.destroy({ where: {}, truncate: true }),
      AuditLog.destroy({ where: {}, truncate: true }),
      Memo.destroy({ where: {}, truncate: true }),
      Policy.destroy({ where: {}, truncate: true }),
      PdfDocument.destroy({ where: {}, truncate: true }),
    ]);

    for (const key of keysToClean) {
      try {
        await deletePdfObject(key);
      } catch (cleanupError) {
        console.error(`resetWorkspace: failed to delete ${key}`, cleanupError);
      }
    }

      const hashed = encryptPassword(DEFAULT_IMPORT_PASSWORD);

    await User.findOrCreate({
      where: { email: 'admin@apa.internal' },
      defaults: {
        id: 'USR-000',
        name: 'Alex Chen',
        role: 'admin',
        department: 'IT',
        jobTitle: 'System Administrator',
        email: 'admin@apa.internal',
        username: 'admin',
        password: hashed,
        telegramHandle: '@alexchen',
        avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop&crop=face',
        status: 'active',
        credentialType: 'Administrator',
        lastLogin: new Date().toISOString(),
      } as any,
    });

    await User.findOrCreate({
      where: { email: 'hr@apa.internal' },
      defaults: {
        id: 'USR-001',
        name: 'Elena Vance',
        role: 'hr',
        department: 'Human Resources',
        jobTitle: 'HR Manager',
        email: 'hr@apa.internal',
        username: 'hr',
        password: hashed,
        telegramHandle: '@elenavance',
        avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face',
        status: 'active',
        credentialType: 'HR Staff',
        lastLogin: new Date().toISOString(),
      } as any,
    });

    const rolePerms = [
      { role: 'admin', canViewHandbook: true, canViewAllStaffStatus: true, canVerifyAcknowledgements: true, canCreateMemos: true, canUploadDocuments: true, canManageTelegramBot: true, canManageUsersAndRoles: true, canExportAuditLogs: true },
      { role: 'hr', canViewHandbook: true, canViewAllStaffStatus: true, canVerifyAcknowledgements: true, canCreateMemos: true, canUploadDocuments: true, canManageTelegramBot: true, canManageUsersAndRoles: true, canExportAuditLogs: true },
      { role: 'manager', canViewHandbook: true, canViewAllStaffStatus: true, canVerifyAcknowledgements: true, canCreateMemos: true, canUploadDocuments: false, canManageTelegramBot: false, canManageUsersAndRoles: false, canExportAuditLogs: false },
      { role: 'staff', canViewHandbook: true, canViewAllStaffStatus: false, canVerifyAcknowledgements: false, canCreateMemos: false, canUploadDocuments: false, canManageTelegramBot: false, canManageUsersAndRoles: false, canExportAuditLogs: false },
    ] as const;

    for (const rp of rolePerms) {
      await RolePermissions.findOrCreate({ where: { role: rp.role }, defaults: rp as any });
    }

    const botCount = await TelegramBotSettings.count();
    if (botCount === 0) {
      await TelegramBotSettings.create({
        botName: 'APA Memo Verifier Bot',
        botUsername: '@apa_memo_verifier',
        hrOfficerTelegram: '@hr_officer',
        channelName: '@apa_announcements',
        autoVerifyWithBotToken: false,
        activeStatusScheme: 'standard',
      } as any);
    }

    res.json({ success: true, message: 'Workspace reset to clean production slate', defaultPassword: DEFAULT_IMPORT_PASSWORD });
  } catch (error) {
    console.error('resetWorkspace error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};