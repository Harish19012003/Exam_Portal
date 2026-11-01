import { Router } from 'express';
import * as userController from './user.controller.js';
import * as groupController from './user-group.controller.js';
import * as tableConfigController from './user-table-config.controller.js';
import * as tagController from './user-tag.controller.js';
import { authenticate, authorize } from '../../../core/auth.middleware.js';
import { requirePage, requireSuperAdmin, getAccessFor } from '../../../core/access.js';
import { successResponse } from '../../../core/response.js';
import { ROLES } from '@exam-view/shared';

const router = Router();

// Get logged-in user profile
router.get('/profile', authenticate, userController.getProfile);
router.patch('/profile', authenticate, userController.updateProfile);
router.put('/profile', authenticate, userController.updateProfile);

// Effective access of the signed-in user (groups + overrides resolved).
router.get('/me/access', authenticate, async (req, res, next) => {
  try {
    return successResponse(res, await getAccessFor(req.user.id));
  } catch (error) {
    next(error);
  }
});

const usersPage = [authenticate, requirePage('users')];
const superAdminOnly = [authenticate, requireSuperAdmin];
// Assignee pickers on exam center lists — any signed-in user (row ACL still applies on save/list).
const signedIn = [authenticate];

// Admin list all users
router.get('/', ...usersPage, userController.listUsers);

// Tag-filtered people for "assign row to…" dropdowns (no Users-page gate).
router.get('/assignable', ...signedIn, userController.listAssignable);
router.post('/assignable/resolve', ...signedIn, userController.resolveAssignable);
router.get('/assignable/tags', ...signedIn, tagController.listTags);

// User groups. Declared before '/:id' routes. Membership and permissions are privileges,
// so only a Super Admin may change them.
router.get('/table-config', ...usersPage, tableConfigController.getTableConfig);
router.put('/table-config', ...usersPage, requireSuperAdmin, tableConfigController.saveTableConfig);
// Tags: anyone who can open the Users page can read them; only a Super Admin creates, changes or assigns them.
router.get('/tags', ...usersPage, tagController.listTags);
router.post('/tags', ...superAdminOnly, tagController.createTag);
router.post('/tags/assign', ...superAdminOnly, tagController.assignTags);
router.put('/tags/order', ...superAdminOnly, tagController.reorderTags);
router.put('/tags/:id', ...superAdminOnly, tagController.updateTag);
router.patch('/tags/:id', ...superAdminOnly, tagController.updateTag);
router.delete('/tags/:id', ...superAdminOnly, tagController.deleteTag);
router.put('/:id/tags', ...superAdminOnly, tagController.setUserTags);
router.get('/groups', ...usersPage, groupController.listGroups);
router.post('/groups', ...superAdminOnly, groupController.createGroup);
router.put('/groups/:id', ...superAdminOnly, groupController.updateGroup);
router.patch('/groups/:id', ...superAdminOnly, groupController.updateGroup);
router.delete('/groups/:id', ...superAdminOnly, groupController.deleteGroup);

router.post('/', ...usersPage, userController.createUser);
router.post('/bulk', ...usersPage, userController.bulkCreateUsers);
router.put('/:id', ...usersPage, userController.updateUser);
router.patch('/:id', ...usersPage, userController.updateUser);
router.post('/:id/disable-2fa', ...usersPage, userController.disable2FA);

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
