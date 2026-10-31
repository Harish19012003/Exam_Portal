import { Router } from 'express';
import { successResponse } from '../../../core/response.js';
import { authenticate } from '../../../core/auth.middleware.js';
import { requireTable } from '../../../core/access.js';
import * as service from './exam-preset.service.js';

const router = Router();

const handle = (fn, status = 200) => async (req, res, next) => {
  try {
    return successResponse(res, await fn(req), status);
  } catch (error) {
    next(error);
  }
};

router.use(authenticate);

// Presets are the field templates of exam explore tables: anyone signed in can read them,
// only groups allowed to configure explore tables can change them.
const canConfigure = requireTable('exam_rows', 'configure');

router.get('/', handle(() => service.listPresets()));
router.post('/', canConfigure, handle((req) => service.createPreset(req.body, req.user?.id), 201));
router.patch('/:id', canConfigure, handle((req) => service.updatePreset(req.params.id, req.body)));
router.delete('/:id', canConfigure, handle((req) => service.deletePreset(req.params.id)));

export default router;
