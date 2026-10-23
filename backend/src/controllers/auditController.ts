import { Request, Response } from 'express';
import { AuditLog } from '../models';
import type { AuditActionType, AuditCategory } from '../models/AuditLog';

const ALLOWED_CATEGORIES: AuditCategory[] = ['Directives', 'Policies', 'Access & Roles', 'Verification', 'System'];

const CLIENT_WRITABLE_ACTIONS: AuditActionType[] = [
  'MEMO_CREATED',
  'MEMO_UPDATED',
  'MEMO_DELETED',
  'POLICY_CREATED',
  'POLICY_UPDATED',
  'POLICY_DELETED',
  'PDF_UPLOADED',
  'PDF_UPDATED',
  'PDF_DELETED',
  'USER_UPDATED',
  'USER_ADDED',
  'USER_CREATED',
  'USER_DELETED',
  'PERMISSIONS_UPDATED',
  'ROLE_PERMISSIONS_UPDATED',
  'DEPARTMENT_ADDED',
  'DEPARTMENT_UPDATED',
  'DEPARTMENT_DELETED',
  'ACK_STATUS_UPDATED',
  'ACK_VERIFIED',
  'BOT_SETTINGS_UPDATED',
  'REMINDER_DISPATCHED',
  'REMINDER_SENT',
  'DATA_RESET',
  'DATA_LOADED',
  'DATA_IMPORTED',
];

export const listAuditLogs = async (req: any, res: Response): Promise<void> => {
  try {
    const logs = await AuditLog.findAll({ order: [['createdAt', 'DESC']], limit: 10000 });
    res.json({ success: true, logs });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const createAuditLog = async (req: any, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const data = req.body || {};
    const actionType = data.actionType as AuditActionType;

    if (!CLIENT_WRITABLE_ACTIONS.includes(actionType)) {
      res.status(403).json({
        success: false,
        message: `Action type '${actionType}' is server-generated and cannot be written via the API.`,
      });
      return;
    }

    if (!data.description || typeof data.description !== 'string') {
      res.status(400).json({ success: false, message: 'Description required' });
      return;
    }

    const category = ALLOWED_CATEGORIES.includes(data.category) ? (data.category as AuditCategory) : 'System';

    const log = await AuditLog.create({
      id: `AUD-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      // actor identity is always taken from the verified token, never from the body
      actorId: req.user.id,
      actorName: req.user.name,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      actionType,
      category,
      description: data.description,
      targetId: data.targetId || null,
      targetName: data.targetName || null,
      metadata: data.metadata || null,
      ipAddress: req.ip || null,
    } as any);

    res.json({ success: true, log });
  } catch (error) {
    console.error('createAuditLog error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};