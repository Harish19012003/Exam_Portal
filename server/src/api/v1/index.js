import { Router } from 'express';
import authRoutes from './auth/auth.routes.js';
import userRoutes from './users/user.routes.js';
import notificationRoutes from './notifications/notification.routes.js';
import announcementRoutes from './announcements/announcement.routes.js';
import legalRoutes from './legal/legal.routes.js';
import searchRoutes from './search/search.routes.js';
import vendorRoutes from './vendors/vendor.routes.js';
import settingsRoutes from './settings/settings.routes.js';
import examRoutes from './exams/exam.routes.js';

const router = Router();

// Mount all v1 routes here
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/notifications', notificationRoutes);
router.use('/announcements', announcementRoutes);
router.use('/legal', legalRoutes);
router.use('/search', searchRoutes);
router.use('/vendors', vendorRoutes);
router.use('/settings', settingsRoutes);
router.use('/exams', examRoutes);

// Export main v1 router
export default router;

