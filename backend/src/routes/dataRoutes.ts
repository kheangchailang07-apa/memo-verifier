import { Router } from 'express';
import { authenticateJWT, requireRole } from '../middlewares/auth';
import { getDataHealth, importDataset, resetWorkspace } from '../controllers/dataController';

const router = Router();

router.get('/health', authenticateJWT, requireRole('admin', 'hr'), getDataHealth);
router.post('/import', authenticateJWT, requireRole('admin'), importDataset);
router.post('/reset', authenticateJWT, requireRole('admin'), resetWorkspace);

export default router;