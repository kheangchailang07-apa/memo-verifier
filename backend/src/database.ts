import { connectDB } from './config/database';
import {
User,
  Session,
  Policy,
  Memo,
  Acknowledgement,
  PdfDocument,
  TelegramBotSettings,
  RolePermissions,
  AuditLog,
} from './models';
import { Op } from 'sequelize';
import { v4 as uuidv4 } from 'uuid';
import { encryptPassword, isEncrypted, assertEncryptionKeyConfigured } from './utils/passwordCrypto';
import { seedDepartments } from './controllers/departmentsController';

/**
 * Sequelize's `alter` mode re-issues `CHANGE ... UNIQUE` for every `unique`
 * column on each boot, and MySQL answers by appending another index
 * (email_2, email_3, ...). `users` eventually hit MySQL's 64-index ceiling and
 * the server could no longer start at all, so drop those copies first.
 */
const pruneDuplicateIndexes = async (): Promise<void> => {
  const sequelize = require('./config/database').default;
  const [tableRows] = await sequelize.query('SHOW TABLES');
  const tableKey = Object.keys(tableRows[0] || {})[0];
  if (!tableKey) return;

  for (const row of tableRows) {
    const table = row[tableKey];
    const [indexes] = await sequelize.query(`SHOW INDEX FROM \`${table}\``);
    const columnOf = new Map<string, string>();
    for (const idx of indexes) columnOf.set(idx.Key_name, idx.Column_name);

    for (const idx of indexes) {
      const match = /^(.*)_(\d+)$/.exec(idx.Key_name);
      if (!match) continue;
      if (columnOf.get(match[1]) === idx.Column_name) {
        try {
          await sequelize.query(`ALTER TABLE \`${table}\` DROP INDEX \`${idx.Key_name}\``);
        } catch (error: any) {
          // Both app instances share one database and boot into the same prune
          // pass; if the other one already dropped the index MySQL answers
          // 1091 "Can't DROP ... check that column/key exists" — not an error.
          const code = error?.code || error?.original?.code || error?.parent?.code;
          if (code !== 'ER_CANT_DROP_FIELD_OR_KEY') throw error;
        }
      }
    }
  }
};

/**
 * One-time conversion of legacy plain-text passwords to AES-256-GCM
 * ciphertext. Idempotent: already-encrypted rows (detected by the `enc:v1:`
 * prefix) are skipped, so this is safe to run on every boot and under both
 * PM2 instances booting against the same database.
 */
const migratePasswordsToEncrypted = async (): Promise<void> => {
  const users = await User.findAll({ attributes: ['id', 'password'] });
  let migrated = 0;
  for (const user of users) {
    const stored = (user as any).password;
    if (typeof stored !== 'string' || isEncrypted(stored)) continue;
    await user.update({ password: encryptPassword(stored) } as any);
    migrated++;
  }
  if (migrated > 0) {
    console.log(`[SEC] Encrypted ${migrated} legacy plain-text password(s) in users table.`);
  }
};

export const initializeDatabase = async (): Promise<void> => {
  assertEncryptionKeyConfigured();
  await connectDB();
  await pruneDuplicateIndexes();
  await (require('./config/database').default).sync({ alter: true });

  await migratePasswordsToEncrypted();

  await seedDepartments();


  // seed default role permissions
  const rolePerms = [
    { role: 'admin', canViewHandbook: true, canViewAllStaffStatus: true, canVerifyAcknowledgements: true, canCreateMemos: true, canUploadDocuments: true, canManageTelegramBot: true, canManageUsersAndRoles: true, canExportAuditLogs: true },
    { role: 'hr', canViewHandbook: true, canViewAllStaffStatus: true, canVerifyAcknowledgements: true, canCreateMemos: true, canUploadDocuments: true, canManageTelegramBot: true, canManageUsersAndRoles: true, canExportAuditLogs: true },
    { role: 'manager', canViewHandbook: true, canViewAllStaffStatus: true, canVerifyAcknowledgements: true, canCreateMemos: true, canUploadDocuments: false, canManageTelegramBot: false, canManageUsersAndRoles: false, canExportAuditLogs: false },
    { role: 'staff', canViewHandbook: true, canViewAllStaffStatus: false, canVerifyAcknowledgements: false, canCreateMemos: false, canUploadDocuments: false, canManageTelegramBot: false, canManageUsersAndRoles: false, canExportAuditLogs: false },
  ];
  for (const rp of rolePerms) {
    await RolePermissions.findOrCreate({ where: { role: rp.role }, defaults: rp as any });
  }

  // seed default bot settings
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

  // seed default admin/hr users
  const userCount = await User.count();
  if (userCount === 0) {
    await User.create({
      id: 'USR-000',
      name: 'Alex Chen',
      role: 'admin',
      department: 'IT',
      jobTitle: 'System Administrator',
      email: 'admin@apa.internal',
      username: 'admin',
      password: encryptPassword('password123'),
      telegramHandle: '@alexchen',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop&crop=face',
      status: 'active',
      credentialType: 'Administrator',
      lastLogin: new Date().toISOString(),
      mustChangePassword: false,
    } as any);
    await User.create({
      id: 'USR-001',
      name: 'Elena Vance',
      role: 'hr',
      department: 'Human Resources',
      jobTitle: 'HR Manager',
      email: 'hr@apa.internal',
      username: 'hr',
      password: encryptPassword('password123'),
      telegramHandle: '@elenavance',
      avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face',
      status: 'active',
      credentialType: 'HR Staff',
      lastLogin: new Date().toISOString(),
      mustChangePassword: false,
    } as any);
  }
  // Backfill a login username for any account created before the column existed.
  const missingUsername = await User.findAll({ where: { username: null } });
  for (const u of missingUsername) {
    const base = String(u.email || '').split('@')[0] || u.id.toLowerCase();
    let candidate = base;
    let n = 1;
    while (await User.findOne({ where: { username: candidate, id: { [Op.ne]: u.id } } })) {
      candidate = `${base}${n++}`;
    }
    await u.update({ username: candidate });
  }
};
