import { Router } from 'express';
import { listUsers, createUser, updateUser, deleteUser, revealUserPassword } from '../controllers/usersController';
import { authenticateJWT, requireRole } from '../middlewares/auth';

const router = Router();
router.get('/', authenticateJWT, requireRole('admin', 'hr'), listUsers);
router.post('/', authenticateJWT, requireRole('admin'), createUser);
router.post('/:id/reveal-password', authenticateJWT, requireRole('admin'), revealUserPassword);
router.put('/:id', authenticateJWT, requireRole('admin', 'hr'), updateUser);
router.delete('/:id', authenticateJWT, requireRole('admin'), deleteUser);
export default router;
