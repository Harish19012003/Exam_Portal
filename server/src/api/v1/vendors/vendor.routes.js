import { Router } from 'express';
import * as vendorController from './vendor.controller.js';
import { authenticate, authorize } from '../../../core/auth.middleware.js';
import { ROLES } from '@exam-view/shared';

const router = Router();

// All vendor management routes require authenticated admin access
router.use(authenticate);
router.use(authorize([ROLES.SUPER_ADMIN, ROLES.GLOBAL_ADMIN, ROLES.ADMIN]));

// List all vendors / search & filter
router.get('/', vendorController.listVendors);

// Seed / bulk import vendors into MySQL
router.post('/seed', vendorController.seedVendors);

// Get single vendor by vendor_code
router.get('/:vendorCode', vendorController.getVendor);

// Create vendor
router.post('/', vendorController.createVendor);

// Update vendor by vendor_code
router.put('/:vendorCode', vendorController.updateVendor);
router.patch('/:vendorCode', vendorController.updateVendor);

// Delete vendor by vendor_code
router.delete('/:vendorCode', vendorController.deleteVendor);

export default router;
