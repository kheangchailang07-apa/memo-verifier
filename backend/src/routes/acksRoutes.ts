import { Router } from 'express';
import { listAcks, createAck, updateAck } from '../controllers/acksController';
import { authenticateJWT } from '../middlewares/auth';

const router = Router();
router.get('/', authenticateJWT, listAcks);
router.post('/', authenticateJWT, createAck);
// Authorization (admin/HR, or the owner of the acknowledgement) is enforced in updateAck.
router.put('/:id', authenticateJWT, updateAck);
export default router;
