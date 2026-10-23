import crypto from 'crypto';

/**
 * Reversible AES-256-GCM encryption for stored user passwords.
 *
 * Stored format:  enc:v1:<iv-b64>:<auth-tag-b64>:<ciphertext-b64>
 * The IV is random per encryption, so the same password never yields the
 * same ciphertext. The GCM auth tag protects against tampering.
 *
 * The key comes from PASSWORD_ENCRYPTION_KEY (required — the server refuses
 * to encrypt or verify passwords without it). Any passphrase length works;
 * it is hashed to a 32-byte AES key with SHA-256.
 *
 * decryptPassword() tolerates legacy plain-text values (anything without
 * the `enc:v1:` prefix is returned unchanged) so un-migrated rows keep
 * working; the startup migration in database.ts converts them.
 */

const PREFIX = 'enc:v1:';
const MAX_PLAINTEXT_LENGTH = 180;

let cachedKey: Buffer | null = null;

const getKey = (): Buffer => {
  if (cachedKey) return cachedKey;
  const secret = process.env.PASSWORD_ENCRYPTION_KEY;
  if (!secret || !secret.trim()) {
    throw new Error(
      '[SEC] PASSWORD_ENCRYPTION_KEY is not set. Add it to your .env file — ' +
        'passwords cannot be encrypted or verified without it.'
    );
  }
  cachedKey = crypto.createHash('sha256').update(secret.trim()).digest();
  return cachedKey;
};

export const isEncrypted = (value: unknown): boolean =>
  typeof value === 'string' && value.startsWith(PREFIX);

/**
 * Fails fast at startup when the encryption key is missing, instead of only
 * discovering it later when the first login attempt cannot be verified.
 */
export const assertEncryptionKeyConfigured = (): void => {
  getKey();
};

export const encryptPassword = (plain: string): string => {
  if (typeof plain !== 'string' || plain.length === 0) {
    throw new Error('[SEC] Cannot encrypt an empty password');
  }
  if (plain.length > MAX_PLAINTEXT_LENGTH) {
    throw new Error(
      `[SEC] Password exceeds ${MAX_PLAINTEXT_LENGTH} characters and cannot be stored encrypted`
    );
  }
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${ciphertext.toString('base64')}`;
};

export const decryptPassword = (stored: string): string => {
  if (!isEncrypted(stored)) return stored;
  const [ivPart, tagPart, dataPart] = stored.slice(PREFIX.length).split(':');
  if (!ivPart || !tagPart || !dataPart) {
    throw new Error('[SEC] Stored password is malformed and cannot be decrypted');
  }
  const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), Buffer.from(ivPart, 'base64'));
  decipher.setAuthTag(Buffer.from(tagPart, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(dataPart, 'base64')), decipher.final()]).toString('utf8');
};

export const verifyPassword = (plain: string, stored: string): boolean => {
  try {
    const expected = Buffer.from(decryptPassword(stored), 'utf8');
    const actual = Buffer.from(String(plain ?? ''), 'utf8');
    if (expected.length !== actual.length) return false;
    return crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
};
