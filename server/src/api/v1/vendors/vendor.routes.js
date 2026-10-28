import { Router } from 'express';
import * as vendorController from './vendor.controller.js';
import { authenticate, authorize } from '../../../core/auth.middleware.js';
import { ROLES } from '@exam-view/shared';

const router = Router();

// All vendor management routes require authenticated admin access
router.use(authenticate);
router.use(authorize([ROLES.SUPER_ADMIN, ROLES.GLOBAL_ADMIN, ROLES.ADMIN]));

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
