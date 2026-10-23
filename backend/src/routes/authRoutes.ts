import { Router } from 'express';
import { login, logout, me, refresh, updateProfile, getSignature } from '../controllers/authController';
import { authenticateJWT } from '../middlewares/auth';

const router = Router();

router.post('/login', login);
router.post('/logout', authenticateJWT, logout);
router.get('/me', authenticateJWT, me);
router.get('/signature', authenticateJWT, getSignature);
router.put('/profile', authenticateJWT, updateProfile);
router.post('/refresh', refresh);

export default router;
