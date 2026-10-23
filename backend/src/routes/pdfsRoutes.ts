import { Router } from 'express';
import {
  listPdfs,
  createPdf,
  updatePdf,
  deletePdf,
  getPdfUrl,
  pdfUploadMiddleware,
} from '../controllers/pdfsController';
import { authenticateJWT, requireRole } from '../middlewares/auth';

const router = Router();
router.get('/', authenticateJWT, listPdfs);
router.get('/:id/url', authenticateJWT, getPdfUrl);
router.post('/', authenticateJWT, requireRole('admin', 'hr', 'manager'), pdfUploadMiddleware, createPdf);
router.put('/:id', authenticateJWT, requireRole('admin', 'hr', 'manager'), updatePdf);
router.delete('/:id', authenticateJWT, requireRole('admin'), deletePdf);
export default router;
