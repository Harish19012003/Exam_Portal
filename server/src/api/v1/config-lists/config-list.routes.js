import { Router } from 'express';
import { successResponse } from '../../../core/response.js';
import { authenticate } from '../../../core/auth.middleware.js';
import { requireTable } from '../../../core/access.js';
import * as service from './config-list.service.js';

const router = Router();

const handle = (fn, status = 200) => async (req, res, next) => {
  try {
    return successResponse(res, await fn(req), status);
  } catch (error) {
    next(error);
  }
};

const ctxOf = (req) => ({
  userId: req.user?.id,
  ip: req.ip,
  userAgent: req.get('user-agent') || null,
});

router.use(authenticate);

// Anyone signed in can read the lists (exam fields use them); only groups allowed to
// configure explore tables can change them.
const canConfigure = requireTable('exam_rows', 'configure');

router.get('/', handle(() => service.listLists()));
router.post('/bulk', canConfigure, handle((req) => service.bulkUpsert(req.body, ctxOf(req)), 201));
router.post('/', canConfigure, handle((req) => service.createList(req.body, ctxOf(req)), 201));
router.patch('/:id', canConfigure, handle((req) => service.updateList(req.params.id, req.body, ctxOf(req))));
router.delete('/:id', canConfigure, handle((req) => service.deleteList(req.params.id, ctxOf(req))));

export default router;
