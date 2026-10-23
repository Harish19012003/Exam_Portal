import { Router } from 'express';
import * as userController from './user.controller.js';
import { authenticate, authorize } from '../../../core/auth.middleware.js';
import { ROLES } from '@exam-view/shared';

const router = Router();

// Get logged-in user profile
router.get('/profile', authenticate, userController.getProfile);
router.patch('/profile', authenticate, userController.updateProfile);
router.put('/profile', authenticate, userController.updateProfile);

// Admin list all users
router.get(
  '/',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.GLOBAL_ADMIN, ROLES.ADMIN]),
  userController.listUsers
);

// Admin only: create a new user directly
router.post(
  '/',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.GLOBAL_ADMIN, ROLES.ADMIN]),
  userController.createUser
);

// Admin bulk upload users from CSV
router.post(
  '/bulk',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.GLOBAL_ADMIN, ROLES.ADMIN]),
  userController.bulkCreateUsers
);

// Admin update user role, status, rights, and details
router.put(
  '/:id',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.GLOBAL_ADMIN, ROLES.ADMIN]),
  userController.updateUser
);

router.patch(
  '/:id',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.GLOBAL_ADMIN, ROLES.ADMIN]),
  userController.updateUser
);

// Disable 2FA for a user
router.post(
  '/:id/disable-2fa',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.GLOBAL_ADMIN, ROLES.ADMIN]),
  userController.disable2FA
);

// Delete user: Primary super admin can delete any (except themselves), others cannot delete super admin
router.delete(
  '/:id',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.GLOBAL_ADMIN]),
  userController.deleteUser
);

// Transfer Primary Super Admin status to another Super Admin
router.post(
  '/:id/transfer-primary',
  authenticate,
  authorize([ROLES.SUPER_ADMIN]),
  userController.transferPrimary
);

export default router;
