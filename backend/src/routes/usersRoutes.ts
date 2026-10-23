import { Router } from 'express';
import { listUsers, createUser, updateUser, deleteUser } from '../controllers/usersController';
import { authenticateJWT, requireRole } from '../middlewares/auth';

const router = Router();
router.get('/', authenticateJWT, requireRole('admin', 'hr'), listUsers);
router.post('/', authenticateJWT, requireRole('admin'), createUser);
router.put('/:id', authenticateJWT, requireRole('admin', 'hr'), updateUser);
router.delete('/:id', authenticateJWT, requireRole('admin'), deleteUser);
export default router;
