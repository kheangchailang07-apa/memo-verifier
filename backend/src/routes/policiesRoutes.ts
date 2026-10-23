import { Router } from 'express';
import { listPolicies, createPolicy, updatePolicy, deletePolicy } from '../controllers/policiesController';
import { authenticateJWT, requireRole } from '../middlewares/auth';

const router = Router();
router.get('/', authenticateJWT, listPolicies);
router.post('/', authenticateJWT, requireRole('admin', 'hr', 'manager'), createPolicy);
router.put('/:id', authenticateJWT, requireRole('admin'), updatePolicy);
router.delete('/:id', authenticateJWT, requireRole('admin'), deletePolicy);
export default router;
