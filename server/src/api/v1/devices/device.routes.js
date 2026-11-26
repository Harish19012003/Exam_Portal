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
router.put('/api-config', deviceController.saveApiConfig);
router.post('/api-config/test', deviceController.testApiConfig);
router.post('/sync', deviceController.syncFromApi);

router.post('/import', deviceController.importDevices);
router.post('/delete', deviceController.deleteDevices);

router.get('/', deviceController.listDevices);
router.post('/', deviceController.createDevice);
router.get('/:id', deviceController.getDevice);
router.patch('/:id', deviceController.updateDevice);
router.put('/:id', deviceController.updateDevice);
router.delete('/:id', deviceController.deleteDevices);

export default router;
