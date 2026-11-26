import { Router } from 'express';
import * as controller from './center-csr-matching.controller.js';
import { authenticate } from '../../../core/auth.middleware.js';
import { withAccess } from '../../../core/access.js';

const router = Router();

router.use(authenticate, withAccess);

router.get('/config', controller.getConfig);
router.put('/config', controller.saveConfig);

router.post('/import', controller.importRows);
router.post('/delete', controller.deleteRows);

router.get('/', controller.listRows);
router.post('/', controller.createRow);
router.get('/:id', controller.getRow);
router.patch('/:id', controller.updateRow);
router.put('/:id', controller.updateRow);
router.delete('/:id', controller.deleteRows);

export default router;
