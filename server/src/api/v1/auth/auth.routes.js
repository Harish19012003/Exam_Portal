import { Router } from 'express';
import * as authController from './auth.controller.js';
import { authenticate } from '../../../core/auth.middleware.js';

const router = Router();

// Public auth routes
router.post('/login', authController.login);
router.post('/refresh', authController.refresh);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
router.post('/otp/send', authController.sendOtp);
router.post('/otp/verify', authController.verifyOtp);

// 2FA Verification during login challenge (public route with challenge token)
router.post('/2fa/verify', authController.verify2FA);

// Logout (always accessible to clear server cookies, even if access token expired)
router.post('/logout', authController.logout);

// Protected 2FA Management (for current user session)
router.post('/2fa/setup', authenticate, authController.setup2FA);
router.post('/2fa/enable', authenticate, authController.enable2FA);
router.post('/2fa/disable', authenticate, authController.disable2FA);

export default router;
