import { Router } from 'express';
import { successResponse } from '../../../core/response.js';
import { authenticate, authorize } from '../../../core/auth.middleware.js';
import { ROLES } from '@exam-view/shared';
import * as service from './exam-preset.service.js';

const router = Router();

const ADMIN_ROLES = [ROLES.SUPER_ADMIN, ROLES.GLOBAL_ADMIN, ROLES.ADMIN];

const handle = (fn, status = 200) => async (req, res, next) => {
  try {
    return successResponse(res, await fn(req), status);
  } catch (error) {
    next(error);
  }
};

router.use(authenticate);

// Everyone can read (the Explore page needs the matching preset); only admins change them.
router.get('/', handle(() => service.listPresets()));
router.post('/', authorize(ADMIN_ROLES), handle((req) => service.createPreset(req.body, req.user?.id), 201));
router.patch('/:id', authorize(ADMIN_ROLES), handle((req) => service.updatePreset(Number(req.params.id), req.body)));
router.delete('/:id', authorize(ADMIN_ROLES), handle((req) => service.deletePreset(Number(req.params.id))));

export default router;
