import { Router } from 'express';
import * as settingsController from './settings.controller.js';
import { authenticate, authorize } from '../../../core/auth.middleware.js';
import { requireTable } from '../../../core/access.js';
import { ROLES } from '@exam-view/shared';

const router = Router();

router.use(authenticate);

/** All authenticated members can load the shared exam table config */
router.get('/exam-table-config', settingsController.getExamTableConfig);

/** Groups with the exams "configure" right publish Feature Builder + field schema for everyone */
router.put(
  '/exam-table-config',
  requireTable('exams', 'configure'),
  settingsController.putExamTableConfig,
);

/** Table layout: user prefs + org default (super admin sets default) */
router.get('/table-layout/:tableId', settingsController.getTableLayout);
router.put('/table-layout/:tableId', settingsController.putUserTableLayout);
router.delete('/table-layout/:tableId', settingsController.deleteUserTableLayout);
router.put(
  '/table-layout/:tableId/default',
  authorize([ROLES.SUPER_ADMIN]),
  settingsController.putOrgTableLayoutDefault,
);

export default router;
