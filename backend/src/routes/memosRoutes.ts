import { Router } from 'express';
import { listMemos, createMemo, updateMemo, deleteMemo } from '../controllers/memosController';
import { authenticateJWT, requireRole } from '../middlewares/auth';

const router = Router();
router.get('/', authenticateJWT, listMemos);
router.post('/', authenticateJWT, requireRole('admin', 'hr', 'manager'), createMemo);
router.put('/:id', authenticateJWT, requireRole('admin', 'hr', 'manager'), updateMemo);
router.delete('/:id', authenticateJWT, requireRole('admin', 'hr'), deleteMemo);
export default router;
