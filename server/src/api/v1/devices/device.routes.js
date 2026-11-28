import { Router } from 'express';
import * as deviceController from './device.controller.js';
import { authenticate } from '../../../core/auth.middleware.js';
import { withAccess } from '../../../core/access.js';

const router = Router();

// Group permissions (table actions, columns, row rules) are checked in the controller.
router.use(authenticate, withAccess);

// Device table config (device_meta) plus Feature Builder settings. Rows are stored in the `shifts` collection.
// Static paths are declared before '/:id'.
router.get('/config', deviceController.getConfig);
router.put('/config', deviceController.saveConfig);

router.get('/api-config', deviceController.getApiConfig);
router.get('/api-config/reveal', deviceController.revealApiSecret);
router.put('/api-config', deviceController.saveApiConfig);
router.post('/api-config/test', deviceController.testApiConfig);
router.post('/sync', deviceController.syncFromApi);

/** Report tabs (Stats Center, Training, …) — rows live in device_* collections. */
router.get('/tabs/:view/fields', deviceController.getTabFields);
router.get('/tabs/:view/rows', deviceController.listTabRows);
router.post('/tabs/:view/delete', deviceController.deleteTabRows);

router.post('/import', deviceController.importDevices);
router.post('/delete', deviceController.deleteDevices);

router.get('/', deviceController.listDevices);
router.post('/', deviceController.createDevice);
router.get('/:id', deviceController.getDevice);
router.patch('/:id', deviceController.updateDevice);
router.put('/:id', deviceController.updateDevice);
router.delete('/:id', deviceController.deleteDevices);

export default router;
