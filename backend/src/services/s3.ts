import { randomUUID } from 'crypto';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { loadEnv } from '../config/env';

loadEnv();

const REGION = process.env.AWS_REGION || 'ap-southeast-2';
const BUCKET = process.env.AWS_S3_BUCKET || 'image-apa';
const PREFIX = (process.env.AWS_S3_PREFIX || 'pdfs_memo').replace(/^\/+|\/+$/g, '');
// Electronic signatures live in their own prefix so they can be lifecycle-managed
// (and audited) separately from the memo attachments.
const SIGNATURE_PREFIX = (process.env.AWS_S3_SIGNATURE_PREFIX || 'signatures_memo').replace(/^\/+|\/+$/g, '');

let client: S3Client | null = null;

const getClient = (): S3Client => {
  if (!client) {
    client = new S3Client({ region: REGION });
  }
  return client;
};

export const s3Config = { region: REGION, bucket: BUCKET, prefix: PREFIX };
export const s3SignatureConfig = { region: REGION, bucket: BUCKET, prefix: SIGNATURE_PREFIX };

/**
 * Builds an object key under the configured prefix. The client-supplied filename
 * is deliberately not used in the path to avoid traversal or overwrite of
 * unrelated objects; the display name is kept in the pdf_documents.fileName column.
 */
export const buildPdfKey = (): string => `${PREFIX}/${randomUUID()}.pdf`;

export const uploadPdf = async (key: string, body: Buffer, contentType: string): Promise<void> => {
  await getClient().send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
      ServerSideEncryption: 'AES256',
    })
  );
};

export const presignGetPdf = async (key: string, ttlSeconds: number): Promise<string> => {
  return getSignedUrl(getClient(), new GetObjectCommand({ Bucket: BUCKET, Key: key }), {
    expiresIn: ttlSeconds,
  });
};

export const deletePdfObject = async (key: string): Promise<void> => {
  await getClient().send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
};

export const isS3Key = (value: unknown): value is string =>
  typeof value === 'string' && value.startsWith(`${PREFIX}/`);

/**
 * Builds an object key for an electronic signature. The owner id only names the
 * folder — it is never a path — and the object itself gets a random name so a
 * replacement signature can never overwrite the previous artwork.
 */
export const buildSignatureKey = (ownerId: string, extension: string = 'png'): string => {
  const owner = String(ownerId || 'unknown').replace(/[^A-Za-z0-9._-]+/g, '-').slice(0, 64) || 'unknown';
  const ext = extension.replace(/[^A-Za-z0-9]/g, '') || 'png';
  return `${SIGNATURE_PREFIX}/${owner}/${randomUUID()}.${ext}`;
};

/** Keeps a single path segment free of traversal and separator characters. */
const sanitizeSegment = (value: unknown): string =>
  String(value ?? '')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^\.+/, '')
    .slice(0, 128);

/** An object key may never contain a traversal or a backslash. */
const isSafeObjectPath = (value: string): boolean =>
  !value.includes('..') && !value.includes('\\') && !value.startsWith('/');

/**
 * Public path of a signature object. The app serves the artwork itself under
 * the same layout as the bucket, so an object key becomes a URL of this app:
 *   signatures_memo/USR-000/<uuid>.png  ->  /signatures_memo/USR-000/<uuid>.png
 */
export const signaturePublicPath = (key: string | null | undefined): string | null => {
  if (!key) return null;
  const clean = String(key).replace(/^\/+/, '');
  if (!clean.startsWith(`${SIGNATURE_PREFIX}/`)) return null;
  if (!isSafeObjectPath(clean)) return null;
  return `/${clean}`;
};

/**
 * Rebuilds an object key from the two segments of a public signature URL.
 * Both segments are sanitised, so a crafted path can never reach another
 * object (or escape the prefix).
 */
export const signatureKeyFromParts = (owner: string, file: string): string | null => {
  const safeOwner = sanitizeSegment(owner);
  const safeFile = sanitizeSegment(file);
  if (!safeOwner || !safeFile) return null;
  const key = `${SIGNATURE_PREFIX}/${safeOwner}/${safeFile}`;
  return isSafeObjectPath(key) ? key : null;
};

/**
 * Extracts the object key from an S3 URL (presigned or plain). It is used to
 * convert the AWS links that were stored earlier into the URLs of this app.
 */
export const s3KeyFromUrl = (value: string | null | undefined): string | null => {
  const raw = String(value ?? '').trim();
  if (!raw) return null;

  // Already an object key.
  if (!/^https?:\/\//i.test(raw)) {
    const clean = raw.replace(/^\/+/, '');
    return clean.startsWith(`${SIGNATURE_PREFIX}/`) && isSafeObjectPath(clean) ? clean : null;
  }

  const path = (raw.split('?')[0] ?? '').split('#')[0] ?? '';
  const marker = `/${SIGNATURE_PREFIX}/`;
  const index = path.indexOf(marker);
  if (index < 0) return null;
  const key = path.slice(index + 1);
  return isSafeObjectPath(key) ? key : null;
};

export const uploadSignature = async (key: string, body: Buffer, contentType: string): Promise<void> => {
  await getClient().send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
      ServerSideEncryption: 'AES256',
    })
  );
};

export const presignGetSignature = async (key: string, ttlSeconds: number): Promise<string> => {
  return getSignedUrl(getClient(), new GetObjectCommand({ Bucket: BUCKET, Key: key }), {
    expiresIn: ttlSeconds,
  });
};

export const deleteSignatureObject = async (key: string): Promise<void> => {
  await getClient().send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
};

/** Downloads a stored signature so it can be embedded in a document again. */
export const getSignatureObject = async (
  key: string
): Promise<{ body: Buffer; contentType: string | null }> => {
  const result = await getClient().send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  const stream = result.Body as any;
  if (!stream) {
    throw new Error('The stored signature is empty.');
  }
  let body: Buffer;
  if (typeof stream.transformToByteArray === 'function') {
    body = Buffer.from(await stream.transformToByteArray());
  } else {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    body = Buffer.concat(chunks);
  }
  return { body, contentType: result.ContentType ?? null };
};

export const isSignatureS3Key = (value: unknown): value is string =>
  typeof value === 'string' && value.startsWith(`${SIGNATURE_PREFIX}/`);
