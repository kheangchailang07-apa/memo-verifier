import { Request, Response } from 'express';
import { Acknowledgement, RolePermissions, User } from '../models';
import { originFromRequest, signaturePublicUrl } from '../services/signatureStorage';

const canViewAllAcks = async (role: string): Promise<boolean> => {
  if (role === 'admin' || role === 'hr') return true;
  const perms = await RolePermissions.findOne({ where: { role } });
  return Boolean(perms?.canViewAllStaffStatus);
};

/**
 * The electronic signature is optional: the staff member may sign the memo
 * with their artwork or acknowledge it without one. The URL is derived from the
 * artwork that is on the account, never taken from the request, and it points
 * at this app instead of at a presigned AWS link.
 */
const resolveSignature = (
  requested: unknown,
  signatureS3Key: string | null | undefined,
  origin?: string | null
): { signatureS3Key: string | null; signatureUrl: string | null; signatureApplied: boolean } => {
  const wanted = requested === undefined ? true : Boolean(requested);
  const key = wanted ? signatureS3Key || null : null;
  return {
    signatureS3Key: key,
    signatureUrl: key ? signaturePublicUrl(key, origin) : null,
    signatureApplied: Boolean(key),
  };
};

export const listAcks = async (req: any, res: Response): Promise<void> => {
  try {
    const viewAll = await canViewAllAcks(req.user.role);

    const acks = await Acknowledgement.findAll({
      ...(viewAll ? {} : { where: { staffId: req.user.id } }),
      order: [['createdAt', 'DESC']],
    });

    // The stored URL belongs to the instance the record was filed on; re-derive
    // it from the object key so every deployment shows its own origin.
    const origin = originFromRequest(req);
    const presented = acks.map((ack) => {
      const plain = ack.toJSON() as any;
      if (plain.signatureS3Key) {
        plain.signatureUrl = signaturePublicUrl(plain.signatureS3Key, origin);
      }
      return plain;
    });

    res.json({ success: true, acks: presented });
  } catch (error) {
    console.error('listAcks error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const createAck = async (req: any, res: Response): Promise<void> => {
  try {
    const data = req.body || {};
    const user = await User.findByPk(req.user.id);

    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    // Acknowledgements are filed by the signed-in user about themselves only.
    const isPrivileged = req.user.role === 'admin' || req.user.role === 'hr';
    const requestedStatus = typeof data.status === 'string' ? data.status : 'Unacknowledged';
    // Staff may file their own sign-off / ping, but never certify it.
    const allowedStatuses = isPrivileged
      ? ['Unacknowledged', 'Submitted', 'In Review', 'HR Verified']
      : ['Unacknowledged', 'Submitted', 'In Review'];
    const status = allowedStatuses.includes(requestedStatus) ? requestedStatus : 'Unacknowledged';

    if (status === 'HR Verified' && !isPrivileged) {
      res.status(403).json({ success: false, message: 'Only HR or admin may file an already-verified acknowledgement.' });
      return;
    }

    // The token is generated client-side so it is the same one shown in the
    // modal and dispatched to HR; fall back to a server token if absent.
    const requestedToken =
      typeof data.verificationToken === 'string' && /^ACK-[A-Za-z0-9-]{4,40}$/.test(data.verificationToken.trim())
        ? data.verificationToken.trim()
        : `ACK-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
    const tokenTaken = await Acknowledgement.findOne({ where: { verificationToken: requestedToken } });
    const verificationToken = tokenTaken
      ? `ACK-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`.toUpperCase()
      : requestedToken;

    // Snapshot the signature artwork at the moment of acknowledgement so the
    // audit trail stays intact if the user replaces or removes their signature
    // later. The staff member can decide not to sign electronically at all.
    const signature = resolveSignature(data.signatureApplied, (user as any).signatureS3Key, originFromRequest(req));

    const ack = await Acknowledgement.create({
      id: `ACK-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      memoId: data.memoId,
      memoNumber: data.memoNumber,
      memoTitle: data.memoTitle,
      // identity always comes from the session, never from the request body
      staffId: user.id,
      staffName: user.name,
      staffEmail: user.email,
      department: user.department,
      staffTelegramHandle: user.telegramHandle,
      status,
      verificationToken,
      portalTimestamp: data.portalTimestamp || null,
      telegramSentTimestamp: data.telegramSentTimestamp || null,
      telegramMessageSnippet: data.telegramMessageSnippet || null,
      hrVerifiedTimestamp: status === 'HR Verified' ? new Date().toISOString() : null,
      hrOfficerName: status === 'HR Verified' ? req.user.name : null,
      hrNotes: null,
      ipAddress: req.ip || null,
      signatureS3Key: signature.signatureS3Key,
      signatureUrl: signature.signatureUrl,
      signatureApplied: signature.signatureApplied,
    } as any);

    res.json({ success: true, ack });
  } catch (error) {
    console.error('createAck error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const ACK_UPDATABLE_FIELDS = [
  'status',
  'portalTimestamp',
  'telegramSentTimestamp',
  'telegramMessageSnippet',
  'hrVerifiedTimestamp',
  'hrOfficerName',
  'hrNotes',
] as const;

// Staff may progress their own acknowledgement but never certify it or touch HR fields.
const ACK_OWNER_UPDATABLE_FIELDS = [
  'status',
  'portalTimestamp',
  'telegramSentTimestamp',
  'telegramMessageSnippet',
] as const;
const ACK_OWNER_STATUSES = ['Unacknowledged', 'Submitted', 'In Review'] as const;

export const updateAck = async (req: any, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const ack = await Acknowledgement.findByPk(id);
    if (!ack) {
      res.status(404).json({ success: false, message: 'Acknowledgement not found' });
      return;
    }

    const isPrivileged = req.user.role === 'admin' || req.user.role === 'hr';
    const isOwner = ack.staffId === req.user.id;
    if (!isPrivileged && !isOwner) {
      res.status(403).json({ success: false, message: 'You may only update your own acknowledgement.' });
      return;
    }

    const allowedFields = isPrivileged ? ACK_UPDATABLE_FIELDS : ACK_OWNER_UPDATABLE_FIELDS;
    const updates: Record<string, any> = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }

    if (!isPrivileged) {
      if (updates.status !== undefined && !(ACK_OWNER_STATUSES as readonly string[]).includes(updates.status)) {
        res.status(403).json({ success: false, message: 'Only HR or admin may certify an acknowledgement.' });
        return;
      }
      // hr* fields are never in the owner allow-list; make that explicit.
      delete updates.hrVerifiedTimestamp;
      delete updates.hrOfficerName;
      delete updates.hrNotes;

      // The electronic signature is the one thing the staff member may still
      // change: it is their own artwork and the URL is derived from the
      // account. A certified record is sealed and stays untouched.
      if (req.body.signatureApplied !== undefined) {
        if (ack.status === 'HR Verified') {
          res.status(409).json({ success: false, message: 'This acknowledgement is already certified.' });
          return;
        }
        const user = await User.findByPk(req.user.id);
        const signature = resolveSignature(req.body.signatureApplied, (user as any)?.signatureS3Key, originFromRequest(req));
        updates.signatureApplied = signature.signatureApplied;
        updates.signatureS3Key = signature.signatureS3Key;
        updates.signatureUrl = signature.signatureUrl;
      }
    }

    if (updates.status === 'HR Verified') {
      if (!ack.verificationToken) {
        res.status(400).json({ success: false, message: 'Cannot verify an acknowledgement without a verification token.' });
        return;
      }
      updates.hrVerifiedTimestamp = new Date().toISOString();
      updates.hrOfficerName = req.user.name;
    }

    await ack.update(updates);
    res.json({ success: true, ack });
  } catch (error) {
    console.error('updateAck error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};