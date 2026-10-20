import { Router } from 'express';
import * as authController from './auth.controller.js';
import { authenticate } from '../../../core/auth.middleware.js';

const router = Router();

// Public auth routes
router.post('/login', authController.login);
router.post('/refresh', authController.refresh);

// Protected auth routes (requires valid access token)
router.post('/logout', authenticate, authController.logout);

// TODO: Add routes for SSO (Google, Microsoft), Forgot Password, Reset Password, 2FA.

export default router;
