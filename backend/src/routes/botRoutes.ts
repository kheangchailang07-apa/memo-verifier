import { Router } from 'express';
import { getBotSettings, updateBotSettings, getBotGroups, getBotChatId, sendBotMessage, resolveUsername, sendAckPing, sendWelcomeMessage, broadcastReminder, testPing } from '../controllers/botController';
import { authenticateJWT, requireRole } from '../middlewares/auth';

const router = Router();
router.get('/', authenticateJWT, getBotSettings);
router.put('/', authenticateJWT, requireRole('admin', 'hr'), updateBotSettings);
router.get('/groups', authenticateJWT, requireRole('admin', 'hr'), getBotGroups);
router.get('/chat-id', authenticateJWT, requireRole('admin', 'hr'), getBotChatId);
// Any signed-in user may verify a Telegram username (self-service handle setup).
router.get('/username', authenticateJWT, resolveUsername);
router.post('/send', authenticateJWT, requireRole('admin', 'hr'), sendBotMessage);
// "Telegram connected" confirmation sent to the chat that just tapped /start.
router.post('/welcome', authenticateJWT, requireRole('admin', 'hr'), sendWelcomeMessage);
// Any signed-in staff member may dispatch their own Phase-2 acknowledgement ping.
router.post('/ack-ping', authenticateJWT, sendAckPing);
// Option B - one employee/directive row of the overdue reminder broadcast.
router.post('/broadcast', authenticateJWT, requireRole('admin', 'hr'), broadcastReminder);
// Option C - employee self-service Telegram 2FA handshake test.
router.post('/test-ping', authenticateJWT, testPing);
export default router;
