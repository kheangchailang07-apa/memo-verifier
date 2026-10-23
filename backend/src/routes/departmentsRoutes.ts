import { Router } from 'express';
import {
  listDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
} from '../controllers/departmentsController';
import { authenticateJWT, requireRole } from '../middlewares/auth';

const router = Router();
router.get('/', authenticateJWT, listDepartments);
router.post('/', authenticateJWT, requireRole('admin'), createDepartment);
router.put('/:id', authenticateJWT, requireRole('admin'), updateDepartment);
router.delete('/:id', authenticateJWT, requireRole('admin'), deleteDepartment);
export default router;
