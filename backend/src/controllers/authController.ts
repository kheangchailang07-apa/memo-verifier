import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { Op } from 'sequelize';
import { User, Session, AuditLog } from '../models';
import { v4 as uuidv4 } from 'uuid';
import { encryptPassword, decryptPassword, verifyPassword } from '../utils/passwordCrypto';
import { normalizeSignatureDataUrl, normalizeSignatureFileName } from '../utils/signature';
import { originFromRequest, presentUser, removeSignatureObject, signaturePublicUrl, storeSignatureImage } from '../services/signatureStorage';
import { readSignatureDataUrl } from '../services/signatureStorage';

// Cookies must be Secure on the https domains but not on plain-http local dev:
// NODE_ENV=production switches them on, or set COOKIE_SECURE=true/false explicitly.
const cookieSecure = (): boolean =>
  process.env.COOKIE_SECURE != null
    ? process.env.COOKIE_SECURE === 'true'
    : process.env.NODE_ENV === 'production';

const authCookie = () => ({
  httpOnly: true,
  secure: cookieSecure(),
  sameSite: 'lax' as const,
});

const generateAccessToken = (user: any) => {
  return jwt.sign({ id: user.id, email: user.email, role: user.role, name: user.name, department: user.department }, process.env.JWT_SECRET as string, {
    expiresIn: process.env.JWT_EXPIRES_IN as any,
  });
};

const generateRefreshToken = (user: any) => {
  return jwt.sign({ id: user.id, email: user.email, role: user.role, name: user.name, jti: uuidv4() }, process.env.JWT_REFRESH_SECRET as string, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN as any,
  });
};

const getRefreshTokenExpiry = (): Date => {
  const raw = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
  const match = /^(\d+)([smhd])$/.exec(raw.trim());
  if (!match) return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const value = Number(match[1] ?? '7');
  const multipliers: Record<string, number> = { s: 1000, m: 60 * 1000, h: 60 * 60 * 1000, d: 24 * 60 * 60 * 1000 };
  return new Date(Date.now() + value * (multipliers[match[2] ?? 'd'] ?? multipliers['d'] ?? 7 * 24 * 60 * 60 * 1000));
};

const purgeExpiredSessions = async (userId: string): Promise<void> => {
  await Session.destroy({ where: { userId, expiresAt: { [Op.lt]: new Date() } } });
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, username, password } = req.body;
    // Login accepts either an email address or a username in the same field.
    const rawIdentifier = String(username ?? email ?? '').trim();
    if (!rawIdentifier || !password) {
      res.status(400).json({ success: false, message: 'Email or username and password required' });
      return;
    }
    // Usernames are stored without a leading '@', so tolerate it on the way in.
    const identifier = rawIdentifier.replace(/^@/, '');
    const user = await User.findOne({
      where: {
        [Op.or]: [
          { email: identifier.toLowerCase() },
          { username: identifier },
          { username: identifier.toLowerCase() },
        ],
      },
    });
    if (!user || user.status === 'suspended') {
      res.status(401).json({ success: false, message: 'Invalid credentials' });
      return;
    }
    const isMatch = verifyPassword(password, user.password);
    if (!isMatch) {
      res.status(401).json({ success: false, message: 'Invalid credentials' });
      return;
    }
    await user.update({ lastLogin: new Date().toISOString() });

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    res.cookie('accessToken', accessToken, {
      ...authCookie(),
      maxAge: 15 * 60 * 1000,
    });
    res.cookie('refreshToken', refreshToken, {
      ...authCookie(),
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    await purgeExpiredSessions(user.id);
    await Session.create({
      id: `SES-${uuidv4()}`,
      userId: user.id,
      refreshToken,
      userAgent: req.headers['user-agent'] || null,
      ipAddress: req.ip || '0.0.0.0',
      expiresAt: getRefreshTokenExpiry(),
    } as any);

    await AuditLog.create({
      id: `AUD-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      actorId: user.id,
      actorName: user.name,
      actorEmail: user.email,
      actorRole: user.role,
      actionType: 'LOGIN',
      category: 'Access & Roles',
      description: `User ${user.name} (${user.role.toUpperCase()}) logged in.`,
      ipAddress: req.ip || '0.0.0.0',
    } as any);

    const { password: pw, ...userWithoutPassword } = user.toJSON();
    res.json({ success: true, user: await presentUser(user, originFromRequest(req)) });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const logout = async (req: any, res: Response): Promise<void> => {
  try {
    if (req.user) {
      await AuditLog.create({
        id: `AUD-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        timestamp: new Date().toISOString(),
        actorId: req.user.id,
        actorName: req.user.name,
        actorEmail: req.user.email,
        actorRole: req.user.role,
        actionType: 'LOGOUT',
        category: 'Access & Roles',
        description: `User ${req.user.name} logged out.`,
        ipAddress: req.ip || '0.0.0.0',
      } as any);

      await Session.update(
        { revokedAt: new Date() },
        { where: { userId: req.user.id, revokedAt: { [Op.is]: null } } }
      );
    }
    // Clearing needs the same flags as setting, or the browser keeps the cookie.
    res.clearCookie('accessToken', authCookie());
    res.clearCookie('refreshToken', authCookie());
    res.json({ success: true, message: 'Logged out' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const me = async (req: any, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }
    const user = await User.findByPk(req.user.id);
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }
    const { password: pw, ...userWithoutPassword } = user.toJSON();
    res.json({ success: true, user: await presentUser(user, originFromRequest(req)) });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const PROFILE_UPDATABLE_FIELDS = [
  'name',
  'username',
  'telegramHandle',
  'jobTitle',
  'department',
  'avatar',
  'signatureDataUrl',
  'signatureFileName',
] as const;

const normalizeProfileUsername = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().replace(/^@/, '');
  return trimmed ? trimmed : null;
};

// Self-service profile editing. Never touches role, email or status, so a
// staff member cannot escalate privileges from their own profile card.
export const updateProfile = async (req: any, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }
    const user = await User.findByPk(req.user.id);
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    const updates: Record<string, any> = {};
    for (const field of PROFILE_UPDATABLE_FIELDS) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }

    if (updates.name !== undefined) {
      const name = String(updates.name).trim();
      if (!name) {
        res.status(400).json({ success: false, message: 'Name cannot be empty' });
        return;
      }
      updates.name = name;
    }

    if (updates.jobTitle !== undefined) {
      updates.jobTitle = String(updates.jobTitle).trim() || user.jobTitle;
    }
    if (updates.department !== undefined) {
      updates.department = String(updates.department).trim() || user.department;
    }
    if (updates.telegramHandle !== undefined) {
      const handle = String(updates.telegramHandle).trim();
      updates.telegramHandle = handle && !handle.startsWith('@') ? `@${handle}` : handle;
    }

    if (updates.username !== undefined) {
      const normalizedUsername = normalizeProfileUsername(updates.username);
      if (normalizedUsername) {
        const taken = await User.findOne({
          where: { username: normalizedUsername, id: { [Op.ne]: user.id } },
        });
        if (taken) {
          res.status(409).json({ success: false, message: 'Username already exists' });
          return;
        }
      }
      updates.username = normalizedUsername;
    }

    if (updates.signatureDataUrl !== undefined) {
      const signature = normalizeSignatureDataUrl(updates.signatureDataUrl);
      if (!signature.ok) {
        res.status(400).json({ success: false, message: signature.message });
        return;
      }

      const previousKey = user.signatureS3Key;

      if (signature.dataUrl && signature.buffer && signature.contentType) {
      // The artwork is saved to S3; only the object key stays on the user row.
      const key = await storeSignatureImage(user.id, signature.buffer, signature.contentType);
      updates.signatureS3Key = key;
      // The URL of this app is stored alongside the key — an AWS presigned
      // link would expire and could not be used as a record.
      updates.signatureS3Url = signaturePublicUrl(key, originFromRequest(req));
      updates.signatureDataUrl = null;
      updates.signatureFileName = normalizeSignatureFileName(updates.signatureFileName);
      await removeSignatureObject(previousKey);
    } else {
      updates.signatureS3Key = null;
      updates.signatureS3Url = null;
      updates.signatureDataUrl = null;
      updates.signatureFileName = null;
      await removeSignatureObject(previousKey);
    }
    } else if (updates.signatureFileName !== undefined) {
      updates.signatureFileName = normalizeSignatureFileName(updates.signatureFileName);
    }

    // Optional password change, always gated behind the current password.
    if (req.body.newPassword !== undefined && String(req.body.newPassword).length > 0) {
      const currentPassword = req.body.currentPassword;
      if (!currentPassword) {
        res.status(400).json({ success: false, message: 'Current password is required to set a new password' });
        return;
      }
      const matches = verifyPassword(String(currentPassword), user.password);
      if (!matches) {
        res.status(400).json({ success: false, message: 'Current password is incorrect' });
        return;
      }
      if (String(req.body.newPassword).length < 8) {
        res.status(400).json({ success: false, message: 'New password must be at least 8 characters' });
        return;
      }
      if (String(req.body.newPassword) === decryptPassword(user.password)) {
        res.status(400).json({ success: false, message: 'New password must be different from the current password' });
        return;
      }
      updates.password = encryptPassword(String(req.body.newPassword));
      // Self-service rotation satisfies any pending first-login/reset gate.
      updates.mustChangePassword = false;
    }

    const changedFields = Object.keys(updates);
    if (changedFields.length === 0) {
      const { password: pw, ...unchanged } = user.toJSON();
      res.json({ success: true, user: await presentUser(user, originFromRequest(req)) });
      return;
    }

    await user.update(updates);

    // The signature payload itself must never reach the audit trail.
    const auditFields = changedFields.map((field) =>
      field === 'signatureDataUrl' || field === 'signatureS3Key' ? 'signature' : field
    );

    await AuditLog.create({
      id: `AUD-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      actorId: user.id,
      actorName: user.name,
      actorEmail: user.email,
      actorRole: user.role,
      actionType: 'UPDATE',
      category: 'Access & Roles',
      description: `User ${user.name} updated their own profile (${auditFields.join(', ')}).`,
      ipAddress: req.ip || '0.0.0.0',
    } as any);

    const { password: pw, ...userWithoutPassword } = user.toJSON();
    res.json({ success: true, user: await presentUser(user, originFromRequest(req)) });
  } catch (error) {
    console.error('updateProfile error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const refresh = async (req: Request, res: Response): Promise<void> => {
  try {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) {
      res.status(401).json({ success: false, message: 'Refresh token required' });
      return;
    }
const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET as string) as any;
    const session = await Session.findOne({
      where: { userId: decoded.id, refreshToken, revokedAt: { [Op.is]: null } },
    });
    if (!session || session.expiresAt.getTime() < Date.now()) {
      res.status(401).json({ success: false, message: 'Invalid refresh token' });
      return;
    }
    const user = await User.findByPk(decoded.id);
    if (!user || user.status === 'suspended') {
      res.status(401).json({ success: false, message: 'Invalid refresh token' });
      return;
    }
    const accessToken = generateAccessToken(user);
    res.cookie('accessToken', accessToken, {
      ...authCookie(),
      maxAge: 15 * 60 * 1000,
    });
    res.json({ success: true, accessToken });
  } catch (error) {
    res.status(401).json({ success: false, message: 'Invalid refresh token' });
  }
};

/** Returns the signature artwork for the signed-in user (used by clients that need a fresh link). */
export const getSignature = async (req: any, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }
    const user = await User.findByPk(req.user.id);
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }
    // The URL of this app never expires, so the client can keep it.
    const url = signaturePublicUrl((user as any).signatureS3Key, originFromRequest(req));
    if (!url) {
      const dataUrl = await readSignatureDataUrl((user as any).signatureS3Key);
      if (dataUrl) {
        res.json({ success: true, dataUrl });
        return;
      }
      res.status(404).json({ success: false, message: 'No signature on file.' });
      return;
    }
    res.json({ success: true, url });
  } catch (error) {
    console.error('getSignature error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
