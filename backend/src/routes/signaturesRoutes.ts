import { Router } from 'express';
import { getSignatureImage } from '../controllers/signaturesController';
import { authenticateJWT } from '../middlewares/auth';

/**
 * The signature artwork is served by this app under the same layout as the
 * bucket (`/<prefix>/<owner>/<file>`), so the URL of a signature never points
 * at AWS. The router is mounted on that prefix in `index.ts`.
 */
const router = Router();

router.get('/:owner/:file', authenticateJWT, getSignatureImage);

export default router;
