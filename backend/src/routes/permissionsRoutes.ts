import { Router } from 'express';
import { listPermissions, updatePermissions } from '../controllers/permissionsController';
import { authenticateJWT, requireRole } from '../middlewares/auth';

const router = Router();
router.get('/', authenticateJWT, listPermissions);
router.put('/', authenticateJWT, requireRole('admin'), updatePermissions);
export default router;
