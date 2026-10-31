import { Router } from 'express';
import authRoutes from './auth/auth.routes.js';
import userRoutes from './users/user.routes.js';
import notificationRoutes from './notifications/notification.routes.js';
import announcementRoutes from './announcements/announcement.routes.js';
import legalRoutes from './legal/legal.routes.js';
import searchRoutes from './search/search.routes.js';
import vendorRoutes from './vendors/vendor.routes.js';
import seqViewRoutes from './seq-views/seq-view.routes.js';
import settingsRoutes from './settings/settings.routes.js';
import examRoutes from './exams/exam.routes.js';
import examTableRoutes from './exam-tables/exam-table.routes.js';
import examPresetRoutes from './exam-presets/exam-preset.routes.js';
import configListRoutes from './config-lists/config-list.routes.js';

const router = Router();

// Mount all v1 routes here
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/notifications', notificationRoutes);
router.use('/announcements', announcementRoutes);
router.use('/legal', legalRoutes);
router.use('/search', searchRoutes);
router.use('/vendors', vendorRoutes);
router.use('/seq-views', seqViewRoutes);
router.use('/settings', settingsRoutes);
router.use('/exam-presets', examPresetRoutes);
router.use('/config-lists', configListRoutes);
router.use('/exams', examTableRoutes);
router.use('/exams', examRoutes);

// Export main v1 router
export default router;

