import { Router } from 'express';
import authRoutes from './authRoutes';
import usersRoutes from './usersRoutes';
import policiesRoutes from './policiesRoutes';
import memosRoutes from './memosRoutes';
import pdfsRoutes from './pdfsRoutes';
import acksRoutes from './acksRoutes';
import botRoutes from './botRoutes';
import permissionsRoutes from './permissionsRoutes';
import auditRoutes from './auditRoutes';
import dataRoutes from './dataRoutes';
import linkTelegramRoutes from './linkTelegramRoutes';
import departmentsRoutes from './departmentsRoutes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', usersRoutes);
router.use('/policies', policiesRoutes);
router.use('/memos', memosRoutes);
router.use('/pdfs', pdfsRoutes);
router.use('/acks', acksRoutes);
router.use('/bot', botRoutes);
router.use('/permissions', permissionsRoutes);
router.use('/audit', auditRoutes);
router.use('/data', dataRoutes);
router.use('/link-telegram', linkTelegramRoutes);
router.use('/departments', departmentsRoutes);

export default router;
