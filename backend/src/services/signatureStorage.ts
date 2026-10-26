import { Acknowledgement } from '../models';
import {
  buildSignatureKey,
  deleteSignatureObject,
  getSignatureObject,
  presignGetSignature,
  s3KeyFromUrl,
  signaturePublicPath,
  uploadSignature,
} from './s3';

/**
 * Storage of the staff member's electronic signature.
 *
 * The artwork is kept under the configured signature storage provider and the
 * database holds only its stable object key. S3 is the default provider; the
 * `local` mode stores files on persistent app storage without AWS credentials.
 */

/** Lifetime of a presigned signature link. */
const presignTtlSeconds = (): number => {
  const parsed = Number(process.env.AWS_PRESIGNED_URL_TTL_SECONDS);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 900;
};

/**
 * Origin this app is reached at. The signature URLs that end up in the
 * database are absolute, so the origin has to be known by the backend.
 *
 * PUBLIC_BASE_URL wins; otherwise the first entry of FRONTEND_URL is used and
 * `http://localhost:3000` is the last resort for a plain local setup.
 */
export const publicBaseUrl = (): string => {
  const explicit = (process.env.PUBLIC_BASE_URL || '').trim();
  if (explicit) return explicit.replace(/\/+$/, '');
  const fromFrontend = (process.env.FRONTEND_URL || '').split(',')[0]?.trim() || '';
  if (fromFrontend) return fromFrontend.replace(/\/+$/, '');
  return 'http://localhost:3000';
};

/** Parses `scheme://host[:port]` out of a URL, or returns '' for anything else. */
const originOf = (value: unknown): string => {
  const raw = String(value ?? '').trim();
  if (!/^https?:\/\//i.test(raw)) return '';
  try {
    const parsed = new URL(raw);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return '';
  }
};

/**
 * Origins whose signature URLs may be stored. Limiting them to the configured
 * instances (plus the local dev servers) keeps a crafted `Origin` header from
 * writing a foreign host into the audit records.
 */
const allowedOrigins = (): string[] => {
  const values = [process.env.PUBLIC_BASE_URL, ...(process.env.FRONTEND_URL || '').split(',')]
    .map((value) => originOf(value))
    .filter(Boolean);
  for (const port of [3000, 3366, 3367]) {
    values.push(`http://localhost:${port}`, `http://127.0.0.1:${port}`);
  }
  return Array.from(new Set(values));
};

/**
 * The URL of a signature artwork as served by this app, e.g.
 *   http://localhost:3366/signatures_memo/USR-000/<uuid>.png
 *
 * The value may be an S3 object key or an AWS URL — an AWS link is converted
 * into the local one, so the stored URL never expires like a presigned link.
 *
 * `origin` is the origin the caller is actually using. The same database is
 * served by more than one deployment (local dev, production), so building the
 * URL from a single env value would hand local users a production link (and
 * the other way around).
 */
export const signaturePublicUrl = (
  value: string | null | undefined,
  origin?: string | null
): string | null => {
  if (!value) return null;
  const key = s3KeyFromUrl(value);
  if (!key) return null;
  const path = signaturePublicPath(key);
  if (!path) return null;
  const requested = originOf(origin);
  const base = requested && allowedOrigins().includes(requested) ? requested : publicBaseUrl();
  return `${base}${path}`;
};

/**
 * Origin the caller is actually using. Prefers the `Origin` (and then
 * `Referer`) of the request when it is one of the known instances, so a
 * signature saved from localhost is stored with the localhost URL.
 */
export const originFromRequest = (req: any): string => {
  const header = (name: string): string => {
    const raw = req?.headers?.[name];
    const value = Array.isArray(raw) ? raw[0] : raw;
    return typeof value === 'string' ? value : '';
  };
  const allowed = allowedOrigins();
  for (const candidate of [originOf(header('origin')), originOf(header('referer'))]) {
    if (candidate && allowed.includes(candidate)) return candidate;
  }
  return publicBaseUrl();
};

/**
 * Uploads the artwork and returns the object key that goes into the database.
 * The old object is never overwritten — a replacement signature always gets a
 * fresh key so acknowledgements that reference the previous artwork stay valid.
 */
export const storeSignatureImage = async (
  ownerId: string,
  body: Buffer,
  contentType: string
): Promise<string> => {
  const extension = contentType.includes('jpeg') || contentType.includes('jpg') ? 'jpg' : 'png';
  const key = buildSignatureKey(ownerId, extension);
  await uploadSignature(key, body, contentType);
  return key;
};

/**
 * In local development, keep a newly captured signature in the legacy data URL
 * column if the selected storage provider itself is unavailable. Production
 * should use either S3 or persistent local file storage.
 */
export const storeSignatureImageForProfile = async (
  ownerId: string,
  body: Buffer,
  contentType: string,
  dataUrl: string
): Promise<{ key: string | null; dataUrl: string | null }> => {
  try {
    return { key: await storeSignatureImage(ownerId, body, contentType), dataUrl: null };
  } catch (error) {
    const publicOrigin = (process.env.PUBLIC_BASE_URL || '').trim();
    const isLocalDevelopmentOrigin = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(publicOrigin);
    const localFallbackEnabled =
      process.env.SIGNATURE_STORAGE_MODE === 'local' && isLocalDevelopmentOrigin;
    if (!localFallbackEnabled) throw error;

    console.warn('[SIG] Signature storage unavailable; storing this signature in the development database.');
    return { key: null, dataUrl };
  }
};

/** Reads a stored signature back as a data URL (for the PDF and the preview). */
export const readSignatureDataUrl = async (key: string | null | undefined): Promise<string | null> => {
  if (!key) return null;
  const { body, contentType } = await getSignatureObject(key);
  return `data:${contentType || 'image/png'};base64,${body.toString('base64')}`;
};

/**
 * Drops the S3 object of a signature that was replaced or removed.
 *
 * An artwork that is already referenced by an acknowledgement record is kept:
 * it is part of the audit trail and must stay retrievable.
 */
export const removeSignatureObject = async (key: string | null | undefined): Promise<void> => {
  if (!key) return;
  try {
    const referenced = await Acknowledgement.count({ where: { signatureS3Key: key } });
    if (referenced > 0) {
      console.log(
        `removeSignatureObject: keeping ${key} — ${referenced} acknowledgement record(s) still reference it`
      );
      return;
    }
    await deleteSignatureObject(key);
  } catch (error) {
    // A failed cleanup must not abort the request that removed the signature.
    console.error('removeSignatureObject: S3 delete failed:', error);
  }
};

/** Mints a short-lived link to the stored artwork. */
export const signaturePresignedUrl = async (key: string | null | undefined): Promise<string | null> => {
  if (!key) return null;
  return presignGetSignature(key, presignTtlSeconds());
};

/**
 * Prepares a user record for the API. The signature artwork is hydrated from
 * S3 so the browser still receives a ready-to-render image, and the object key
 * travels along as `signatureS3Key`.
 *
 * The URLs are the ones of this app (`signatureUrl` / `signatureS3Url`), never
 * the AWS ones: a presigned link expires after a few minutes and could
 * therefore never be stored in the database as the record of a signature.
 */
export const presentUser = async (user: any, origin?: string | null): Promise<Record<string, any>> => {
  const plain = typeof user?.toJSON === 'function' ? user.toJSON() : { ...(user || {}) };
  const { password: pw, ...safe } = plain;

  if (safe.signatureS3Key) {
    try {
      const url = signaturePublicUrl(safe.signatureS3Key, origin);
      safe.signatureUrl = url;
      safe.signatureS3Url = url;
      // The PDF renderer needs the raw bytes, so the artwork is handed over as
      // a data URL. A legacy copy that is still stored on the row wins.
      if (!safe.signatureDataUrl) {
        safe.signatureDataUrl = await readSignatureDataUrl(safe.signatureS3Key);
      }
    } catch (error) {
      // A storage hiccup must not break the session: the account still works,
      // only the artwork preview stays empty.
      console.error('presentUser: the signature artwork could not be read from S3:', error);
    }
  } else {
    safe.signatureUrl = null;
    safe.signatureS3Url = null;
    if (!safe.signatureDataUrl && safe.signatureDataUrl === undefined) {
      safe.signatureDataUrl = null;
    }
  }

  safe.hasSignature = Boolean(safe.signatureS3Key || safe.signatureDataUrl || safe.signatureFileName);
  return safe;
};
