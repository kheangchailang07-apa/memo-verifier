import { Request, Response } from 'express';
import { RolePermissions } from '../models';
import type { UserRole } from '../models/User';

const VALID_ROLES: UserRole[] = ['admin', 'hr', 'manager', 'staff'];

const PERMISSION_FIELDS = [
  'canViewHandbook',
  'canViewAllStaffStatus',
  'canVerifyAcknowledgements',
  'canCreateMemos',
  'canUploadDocuments',
  'canManageTelegramBot',
  'canManageUsersAndRoles',
  'canExportAuditLogs',
] as const;

const toPermissionMap = (perms: RolePermissions[]) => {
  const result: any = {};
  for (const p of perms) result[p.role] = { ...p.toJSON() };
  return result;
};

export const listPermissions = async (req: any, res: Response): Promise<void> => {
  try {
    const perms = await RolePermissions.findAll();
    res.json({ success: true, permissions: toPermissionMap(perms) });
  } catch (error) {
    console.error('listPermissions error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const updatePermissions = async (req: any, res: Response): Promise<void> => {
  try {
    const incoming = req.body?.permissions || {};
    const unknownRoles = Object.keys(incoming).filter((r) => !VALID_ROLES.includes(r as UserRole));
    if (unknownRoles.length > 0) {
      res.status(400).json({ success: false, message: `Unknown role(s): ${unknownRoles.join(', ')}` });
      return;
    }

    for (const role of Object.keys(incoming)) {
      const patch: Record<string, any> = {};
      for (const field of PERMISSION_FIELDS) {
        if (incoming[role][field] !== undefined) patch[field] = Boolean(incoming[role][field]);
      }
      if (Object.keys(patch).length === 0) continue;

      const [affected] = await RolePermissions.update(patch, { where: { role } });
      if (affected === 0) {
        await RolePermissions.create({ role, ...patch } as any);
      }
    }

    const perms = await RolePermissions.findAll();
    res.json({ success: true, permissions: toPermissionMap(perms) });
  } catch (error) {
    console.error('updatePermissions error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};