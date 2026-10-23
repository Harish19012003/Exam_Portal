import { Router } from 'express';
import * as examController from './exam.controller.js';
import { authenticate, authorize } from '../../../core/auth.middleware.js';
import { ROLES } from '@exam-view/shared';

const router = Router();

const WRITE_ROLES = [ROLES.SUPER_ADMIN, ROLES.GLOBAL_ADMIN, ROLES.ADMIN, ROLES.USER];
const ADMIN_ROLES = [ROLES.SUPER_ADMIN, ROLES.GLOBAL_ADMIN, ROLES.ADMIN];

router.use(authenticate);

router.get('/', examController.listExams);
router.post('/import', authorize(ADMIN_ROLES), examController.importExams);
router.get('/:id', examController.getExam);
router.post('/', authorize(WRITE_ROLES), examController.createExam);
router.put('/:id', authorize(WRITE_ROLES), examController.updateExam);
router.patch('/:id', authorize(WRITE_ROLES), examController.updateExam);
router.delete('/:id', authorize(WRITE_ROLES), examController.deleteExam);

export default router;
