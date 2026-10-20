import { Router } from 'express';
import authRoutes from './auth/auth.routes.js';
import userRoutes from './users/user.routes.js';
import notificationRoutes from './notifications/notification.routes.js';
import announcementRoutes from './announcements/announcement.routes.js';
import legalRoutes from './legal/legal.routes.js';
import searchRoutes from './search/search.routes.js';

const router = Router();

// Mount all v1 routes here
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/notifications', notificationRoutes);
router.use('/announcements', announcementRoutes);
router.use('/legal', legalRoutes);
router.use('/search', searchRoutes);

// Export main v1 router
export default router;
