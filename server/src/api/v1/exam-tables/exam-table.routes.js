import { Router } from 'express';
import * as controller from './exam-table.controller.js';
import { authenticate } from '../../../core/auth.middleware.js';
import { withAccess } from '../../../core/access.js';

const router = Router();

// Mounted at /exams, so these live under /exams/:examId/table.
// Access (parent exam visibility, table actions, columns, row rules) is checked in the controller.
router.use('/:examId/table', authenticate, withAccess);

router.get('/:examId/table', controller.getTable);
router.post('/:examId/table', controller.createTable);
// Fields drawer + Feature Builder save
router.put('/:examId/table/config', controller.saveConfig);

router.get('/:examId/table/rows', controller.listRows);
router.post('/:examId/table/rows', controller.createRow);
router.post('/:examId/table/rows/delete', controller.deleteRows);
router.patch('/:examId/table/rows/:rowId', controller.updateRow);

export default router;
