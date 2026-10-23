/**
 * Validation helpers for the staff member's electronic signature image.
 *
 * The image is uploaded from the browser as a data URL (PNG/JPEG) and stored in
 * S3, so the payload has to be checked before it leaves the API: only image
 * data URLs are accepted and the size is capped so a huge picture cannot be
 * pushed into the bucket.
 */

/** Base64 data URL of a signature image must stay below this size. */
export const SIGNATURE_MAX_CHARS = 600 * 1024;

const SIGNATURE_MIME_PATTERN = /^data:image\/(png|jpeg|jpg);base64,/i;

export type SignatureValidation =
  | {
      ok: true;
      /** The validated data URL, or null when the signature was cleared. */
      dataUrl: string | null;
      /** The decoded image bytes — null when the signature was cleared. */
      buffer: Buffer | null;
      /** The MIME type of the image — null when the signature was cleared. */
      contentType: string | null;
    }
  | { ok: false; message: string };

/**
 * Validates an uploaded electronic signature. An empty value clears it.
 */
export const normalizeSignatureDataUrl = (value: unknown): SignatureValidation => {
  if (value === null || value === undefined || value === '') {
    return { ok: true, dataUrl: null, buffer: null, contentType: null };
  }
  if (typeof value !== 'string') {
    return { ok: false, message: 'Signature must be an image data URL.' };
  }
  const dataUrl = value.trim();
  if (!SIGNATURE_MIME_PATTERN.test(dataUrl)) {
    return { ok: false, message: 'Signature must be a PNG or JPEG image.' };
  }
  const payload = dataUrl.slice(dataUrl.indexOf(',') + 1);
  if (!/^[A-Za-z0-9+/=\s]+$/.test(payload)) {
    return { ok: false, message: 'Signature image data is not valid base64.' };
  }
  if (dataUrl.length > SIGNATURE_MAX_CHARS) {
    return { ok: false, message: 'Signature image is too large (max 450 KB).' };
  }

  const contentType = /^data:image\/jpe?g/i.test(dataUrl) ? 'image/jpeg' : 'image/png';
  const buffer = Buffer.from(payload, 'base64');
  if (buffer.length === 0) {
    return { ok: false, message: 'Signature image data is not valid base64.' };
  }

  return { ok: true, dataUrl, buffer, contentType };
};

/** Strips path separators and odd characters from the stored file name. */
export const normalizeSignatureFileName = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const cleaned = value.trim().replace(/[^\w.\- ]+/g, '_').slice(0, 150);
  return cleaned || null;
};
