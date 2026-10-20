import { Router } from 'express';
import { notificationController } from './notification.controller.js';
import { requireAuth } from '../auth/auth.middleware.js';

const router = Router();

router.use(requireAuth);

router.get('/', notificationController.getMine);
router.patch('/:id/read', notificationController.markRead);

export default router;
