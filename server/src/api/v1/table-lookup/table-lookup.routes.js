import { Router } from 'express';
import { successResponse } from '../../../core/response.js';
import { authenticate } from '../../../core/auth.middleware.js';
import { withAccess } from '../../../core/access.js';
import * as service from './table-lookup.service.js';

const router = Router();

const handle = (fn) => async (req, res, next) => {
  try {
    return successResponse(res, await fn(req));
  } catch (error) {
    next(error);
  }
};

// Permissions on the source table (view right, hidden columns, row rules) are checked in the service.
router.use(authenticate, withAccess);

router.get('/sources', handle((req) => service.listSources(req)));
router.get('/:table/rows', handle((req) => service.searchRows(req, req.params.table, req.query)));
router.post('/:table/resolve', handle((req) => service.resolveRows(req, req.params.table, req.body)));

export default router;
