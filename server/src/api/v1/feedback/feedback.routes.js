import { Router } from 'express';
import * as feedbackController from './feedback.controller.js';
import { authenticate } from '../../../core/auth.middleware.js';
import { withAccess, requirePage } from '../../../core/access.js';

const router = Router();

router.use(authenticate, withAccess);

// Anyone signed in can report and see their own reports.
router.post('/', feedbackController.create);
router.get('/mine', feedbackController.listMine);

// Triage: people with the Settings page right (Settings → Bugs & Features).
router.get('/', requirePage('settings'), feedbackController.listAll);
router.patch('/:id', requirePage('settings'), feedbackController.update);
router.delete('/:id', requirePage('settings'), feedbackController.remove);

export default router;
