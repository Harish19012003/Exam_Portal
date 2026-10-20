import { Router } from 'express';
import { announcementController } from './announcement.controller.js';
import { requireAuth, requireRole } from '../auth/auth.middleware.js';

const router = Router();

router.use(requireAuth);

router.get('/', announcementController.getAnnouncements);

// Only admins can create or delete announcements
router.post('/', requireRole(['admin']), announcementController.create);
router.delete('/:id', requireRole(['admin']), announcementController.remove);

export default router;
