import { Request, Response } from 'express';
import { AuditLog, User } from '../models';
import { Op } from 'sequelize';
import { v4 as uuidv4 } from 'uuid';
import { decryptPassword, encryptPassword, isEncrypted, verifyPassword } from '../utils/passwordCrypto';
import { normalizeSignatureDataUrl, normalizeSignatureFileName } from '../utils/signature';
import { originFromRequest, presentUser, removeSignatureObject, signaturePublicUrl, storeSignatureImageForProfile } from '../services/signatureStorage';

const USER_UPDATABLE_FIELDS = [
  'name',
  'role',
  'department',
  'jobTitle',
  'email',
  'username',
  'password',
  'telegramHandle',
  'avatar',
  'status',
  'credentialType',
  'assignedDepartments',
  'signatureDataUrl',
  'signatureFileName',
] as const;

const normalizeUsername = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().replace(/^@/, '');
  return trimmed ? trimmed : null;
};

export const listUsers = async (req: any, res: Response): Promise<void> => {
  try {
    // The signature artwork is excluded from the roster payload: it is only
    // needed by the owner (self-service) and by an admin editing that row.
    const rows = await User.findAll({
      attributes: { exclude: ['password', 'signatureDataUrl'] },
    });
    const users = rows.map((row) => {
      const plain = row.toJSON();
      return { ...plain, hasSignature: Boolean(plain.signatureS3Key || plain.signatureFileName) };
    });
    res.json({ success: true, users });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/** Reveals one account password after the signed-in administrator reauthenticates. */
export const revealUserPassword = async (req: any, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      res.status(403).json({ success: false, message: 'Only administrators can reveal account passwords.' });
      return;
    }

    const adminPassword = String(req.body?.adminPassword ?? '');
    if (!adminPassword) {
      res.status(400).json({ success: false, message: 'Enter your administrator password to continue.' });
      return;
    }

    const admin = await User.findByPk(req.user.id);
    if (!admin || !verifyPassword(adminPassword, admin.password)) {
      res.status(401).json({ success: false, message: 'Administrator password is incorrect.' });
      return;
    }

    const target = await User.findByPk(req.params.id);
    if (!target) {
      res.status(404).json({ success: false, message: 'User not found.' });
      return;
    }

    await AuditLog.create({
      id: `AUD-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      actorId: admin.id,
      actorName: admin.name,
      actorEmail: admin.email,
      actorRole: admin.role,
      actionType: 'USER_PASSWORD_REVEALED',
      category: 'Access & Roles',
      description: `Administrator revealed the account password for ${target.name}.`,
      targetId: target.id,
      targetName: target.name,
      ipAddress: req.ip || '0.0.0.0',
    } as any);

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.json({ success: true, password: decryptPassword(target.password) });
  } catch (error) {
    console.error('revealUserPassword error:', error);
    res.status(500).json({ success: false, message: 'Unable to reveal this account password.' });
  }
};

export const createUser = async (req: any, res: Response): Promise<void> => {
  try {
    const { name, role, department, jobTitle, email, username, password = 'password123', telegramHandle, avatar, status = 'active', credentialType, lastLogin = new Date().toISOString(), assignedDepartments, mustChangePassword } = req.body;
    if (!name || !role || !department || !jobTitle || !email) {
      res.status(400).json({ success: false, message: 'Missing required fields' });
      return;
    }
    const normalizedEmail = String(email).toLowerCase();
    const normalizedUsername = normalizeUsername(username);
    const existing = await User.findOne({ where: { email: normalizedEmail } });
    if (existing) {
      res.status(409).json({ success: false, message: 'Email already exists' });
      return;
    }
    if (normalizedUsername) {
      const taken = await User.findOne({ where: { username: normalizedUsername } });
      if (taken) {
        res.status(409).json({ success: false, message: 'Username already exists' });
        return;
      }
    }
    const user = await User.create({
      id: `USR-${Date.now()}`,
      name,
      role,
      department,
      jobTitle,
      email: normalizedEmail,
      username: normalizedUsername,
      password: encryptPassword(password),
      telegramHandle: telegramHandle || '',
      avatar: avatar || '',
      status,
      credentialType: credentialType || 'Staff',
      lastLogin,
      // New accounts default to forcing a password change on first sign-in,
      // except administrators — they are never gated by the first-login flow.
      mustChangePassword:
        role === 'admin' ? false : mustChangePassword !== undefined ? Boolean(mustChangePassword) : true,
      assignedDepartments: assignedDepartments || null,
    } as any);
    const { password: pw, ...userWithoutPassword } = user.toJSON();
    res.json({ success: true, user: await presentUser(user, originFromRequest(req)) });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const updateUser = async (req: any, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const user = await User.findByPk(id);
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    const updates: Record<string, any> = {};
    for (const field of USER_UPDATABLE_FIELDS) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }

    if (updates.name !== undefined) {
      const name = String(updates.name).trim();
      if (!name) {
        res.status(400).json({ success: false, message: 'Full name cannot be empty.' });
        return;
      }
      if (name.length > 100) {
        res.status(400).json({ success: false, message: 'Full name must be 100 characters or fewer.' });
        return;
      }
      updates.name = name;
    }

    // Only an admin may grant or change a role. 'hr' cannot escalate anyone to admin.
    if (updates.role !== undefined && req.user.role !== 'admin') {
      res.status(403).json({ success: false, message: 'Only an administrator may change a user role.' });
      return;
    }

    if (updates.username !== undefined) {
      const normalizedUsername = normalizeUsername(updates.username);
      if (normalizedUsername) {
        const taken = await User.findOne({
          where: { username: normalizedUsername, id: { [Op.ne]: id } },
        });
        if (taken) {
          res.status(409).json({ success: false, message: 'Username already exists' });
          return;
        }
      }
      updates.username = normalizedUsername;
    }

    if (updates.email !== undefined) {
      updates.email = String(updates.email).toLowerCase();
    }

    // The admin form may carry the signature image (a PNG/JPEG data URL).
    // An omitted field keeps whatever is already stored.
    if (updates.signatureDataUrl !== undefined) {
      const signature = normalizeSignatureDataUrl(updates.signatureDataUrl);
      if (!signature.ok) {
        res.status(400).json({ success: false, message: signature.message });
        return;
      }

      const previousKey = (user as any).signatureS3Key;

      if (signature.dataUrl && signature.buffer && signature.contentType) {
        const stored = await storeSignatureImageForProfile(
          user.id,
          signature.buffer,
          signature.contentType,
          signature.dataUrl
        );
        const key = stored.key;
        updates.signatureS3Key = key;
        // The URL of this app is stored alongside the key — an AWS presigned
        // link would expire and could not be used as a record.
        (updates as any).signatureS3Url = key ? signaturePublicUrl(key, originFromRequest(req)) : null;
        updates.signatureDataUrl = stored.dataUrl;
        updates.signatureFileName = normalizeSignatureFileName(updates.signatureFileName);
        if (key) await removeSignatureObject(previousKey);
      } else {
        updates.signatureS3Key = null;
        (updates as any).signatureS3Url = null;
        updates.signatureDataUrl = null;
        updates.signatureFileName = null;
        await removeSignatureObject(previousKey);
      }
    } else if (updates.signatureFileName !== undefined) {
      updates.signatureFileName = normalizeSignatureFileName(updates.signatureFileName);
    }

    // An empty string means "leave the password unchanged"; a real value is an
    // admin-issued reset that forces the holder to rotate it on next sign-in.
    // Administrators are exempt, and the flag is deliberately not taken from
    // the request body: the admin form posts a whole user object whose stale
    // value must not clear the gate.
    if (updates.password !== undefined) {
      if (!updates.password) {
        delete updates.password;
      } else if ((updates.role ?? user.role) !== 'admin') {
        // The admin edit form can echo the stored (already encrypted) value
        // back; never wrap an encrypted value a second time.
        if (!isEncrypted(updates.password)) {
          updates.password = encryptPassword(String(updates.password));
        }
        updates.mustChangePassword = true;
      } else if (!isEncrypted(updates.password)) {
        updates.password = encryptPassword(String(updates.password));
      }
    }

    await user.update(updates);
    const { password: pw, ...userWithoutPassword } = user.toJSON();
    res.json({ success: true, user: await presentUser(user, originFromRequest(req)) });
  } catch (error) {
    console.error('updateUser error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const deleteUser = async (req: any, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const user = await User.findByPk(id);
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }
    if (req.user && req.user.id === user.id) {
      res.status(400).json({ success: false, message: 'Cannot delete yourself' });
      return;
    }
    await user.destroy();
    res.json({ success: true, message: 'User deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
