import { Router } from 'express';
import { getMyLink, checkMyLink, unlinkMyLink } from '../controllers/linkTelegramController';
import { authenticateJWT } from '../middlewares/auth';

const router = Router();
// Any signed-in user may link their own Telegram account (self-service).
router.get('/me', authenticateJWT, getMyLink);
router.post('/check', authenticateJWT, checkMyLink);
router.post('/unlink', authenticateJWT, unlinkMyLink);

export default router;