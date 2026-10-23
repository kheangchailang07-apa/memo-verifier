import { Response } from 'express';
import type { AuthRequest } from '../middlewares/auth';
import { getSignatureObject, signatureKeyFromParts } from '../services/s3';

/**
 * Serves an electronic signature from the bucket under the URL of this app:
 *
 *   GET /signatures_memo/<owner>/<file>.png
 *
 * The bucket itself stays private — every request is authenticated and the
 * object is fetched server-side, so the artwork never leaks through a
 * presigned AWS link.
 */
export const getSignatureImage = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const key = signatureKeyFromParts(String(req.params.owner || ''), String(req.params.file || ''));
    if (!key) {
      res.status(404).json({ success: false, message: 'Signature not found.' });
      return;
    }

    const { body, contentType } = await getSignatureObject(key);

    res.setHeader('Content-Type', contentType || 'image/png');
    res.setHeader('Content-Length', String(body.length));
    // The object name carries a UUID and is never reused, so the artwork can
    // be cached by the browser.
    res.setHeader('Cache-Control', 'private, max-age=86400, immutable');
    res.send(body);
  } catch (error) {
    const status = (error as any)?.name === 'NoSuchKey' ? 404 : 500;
    if (status === 500) console.error('getSignatureImage error:', error);
    res.status(status).json({ success: false, message: 'Signature not found.' });
  }
};
