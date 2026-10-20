import { Router } from 'express';
import { legalController } from './legal.controller.js';
import { requireAuth, requireRole } from '../auth/auth.middleware.js';

const router = Router();

// Publicly readable
router.get('/:type', legalController.getDocument);

// Admin only updatable
router.put('/:type', requireAuth, requireRole(['admin']), legalController.updateDocument);

export default router;
