import { Router } from 'express';
import { listAuditLogs, createAuditLog } from '../controllers/auditController';
import { authenticateJWT, requireRole } from '../middlewares/auth';

const router = Router();
router.get('/', authenticateJWT, requireRole('admin', 'hr'), listAuditLogs);
router.post('/', authenticateJWT, createAuditLog);
export default router;
