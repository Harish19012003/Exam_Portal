import { Router } from 'express';
import * as controller from './exam-table.controller.js';
import { authenticate, authorize } from '../../../core/auth.middleware.js';
import { ROLES } from '@exam-view/shared';

const router = Router();

const ADMIN_ROLES = [ROLES.SUPER_ADMIN, ROLES.GLOBAL_ADMIN, ROLES.ADMIN];
const WRITE_ROLES = [...ADMIN_ROLES, ROLES.USER];

router.use(authenticate);

// Mounted at /exams, so these live under /exams/:examId/table
router.get('/:examId/table', controller.getTable);
router.post('/:examId/table', authorize(ADMIN_ROLES), controller.createTable);
// Fields drawer + Feature Builder save (adds/changes/drops real SQL columns)
router.put('/:examId/table/config', authorize(ADMIN_ROLES), controller.saveConfig);

router.get('/:examId/table/rows', controller.listRows);
router.post('/:examId/table/rows', authorize(WRITE_ROLES), controller.createRow);
router.post('/:examId/table/rows/delete', authorize(WRITE_ROLES), controller.deleteRows);
router.patch('/:examId/table/rows/:rowId', authorize(WRITE_ROLES), controller.updateRow);

export default router;
