import { Router } from 'express';
import * as settingsController from './settings.controller.js';
import { authenticate, authorize } from '../../../core/auth.middleware.js';
import { ROLES } from '@exam-view/shared';

const router = Router();

const CONFIG_ADMIN_ROLES = [ROLES.SUPER_ADMIN, ROLES.GLOBAL_ADMIN, ROLES.ADMIN];

router.use(authenticate);

/** All authenticated members can load the shared exam table config */
router.get('/exam-table-config', settingsController.getExamTableConfig);

/** Super admin / admins publish Feature Builder + field schema for everyone */
router.put(
  '/exam-table-config',
  authorize(CONFIG_ADMIN_ROLES),
  settingsController.putExamTableConfig,
);

export default router;
