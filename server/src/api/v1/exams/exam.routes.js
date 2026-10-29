import { Router } from 'express';
import * as examController from './exam.controller.js';
import { authenticate } from '../../../core/auth.middleware.js';
import { withAccess } from '../../../core/access.js';

const router = Router();

// Table actions, column levels and row rules are checked in the controller (see core/access.js).
router.use(authenticate, withAccess);

router.get('/', examController.listExams);
router.post('/import', examController.importExams);
router.get('/:id', examController.getExam);
router.post('/', examController.createExam);
router.put('/:id', examController.updateExam);
router.patch('/:id', examController.updateExam);
router.delete('/:id', examController.deleteExam);

export default router;
