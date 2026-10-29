import { Router } from 'express';
import * as vendorController from './vendor.controller.js';
import { authenticate } from '../../../core/auth.middleware.js';
import { withAccess } from '../../../core/access.js';

const router = Router();

// Group permissions (table actions, columns, row rules) are checked in the controller.
router.use(authenticate, withAccess);

// Vendor table config: custom fields (stored in the vendors collection's `values`) + Feature Builder settings.
// Static paths are declared before '/:id'.
router.get('/config', vendorController.getConfig);
router.put('/config', vendorController.saveConfig);

router.post('/import', vendorController.importVendors);
router.post('/delete', vendorController.deleteVendors);

router.get('/', vendorController.listVendors);
router.post('/', vendorController.createVendor);
router.get('/:id', vendorController.getVendor);
router.patch('/:id', vendorController.updateVendor);
router.put('/:id', vendorController.updateVendor);
router.delete('/:id', vendorController.deleteVendors);

export default router;
