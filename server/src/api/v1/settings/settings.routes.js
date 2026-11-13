import { Router } from 'express';
import * as settingsController from './settings.controller.js';
import * as platformSettingsController from './platform-settings.controller.js';
import * as messageTemplatesController from './message-templates.controller.js';
import * as emailIntegrationController from './integration-email.controller.js';
import * as storageIntegrationController from './integration-storage.controller.js';
import * as pushIntegrationController from './integration-push.controller.js';
import { authenticate, authorize } from '../../../core/auth.middleware.js';
import { requireTable, requirePage, requireSuperAdmin } from '../../../core/access.js';
import { ROLES } from '@exam-view/shared';

const router = Router();

/** Public branding for login / landing (favicon + portal name) — no auth. */
router.get('/platform/branding', platformSettingsController.getPublicBranding);

router.use(authenticate);

/** All authenticated members can load the shared exam table config */
router.get('/exam-table-config', settingsController.getExamTableConfig);

/** Groups with the exams "configure" right publish Feature Builder + field schema for everyone */
router.put(
  '/exam-table-config',
  requireTable('exams', 'configure'),
  settingsController.putExamTableConfig,
);

/** Platform settings: everyone reads (name, banner); the Settings page right can change them */
router.get('/platform', platformSettingsController.getPlatformSettings);
router.put('/platform', requirePage('settings'), platformSettingsController.putPlatformSettings);
router.post('/platform/branding/signature', requireSuperAdmin, platformSettingsController.getBrandingUploadSignature);

// Email templates: super admin only (they decide what every user receives)
router.get('/message-templates', requireSuperAdmin, messageTemplatesController.list);
router.put('/message-templates/:id', requireSuperAdmin, messageTemplatesController.save);
router.delete('/message-templates/:id', requireSuperAdmin, messageTemplatesController.reset);
router.post('/message-templates/:id/test', requireSuperAdmin, messageTemplatesController.sendTest);

/** Integrations (credentials): Super Admin only */
router.get('/integrations/email', requireSuperAdmin, emailIntegrationController.getEmail);
router.put('/integrations/email', requireSuperAdmin, emailIntegrationController.putEmail);
router.post('/integrations/email/test', requireSuperAdmin, emailIntegrationController.testEmail);
router.get('/integrations/storage', requireSuperAdmin, storageIntegrationController.getStorage);
router.put('/integrations/storage', requireSuperAdmin, storageIntegrationController.putStorage);
router.post('/integrations/storage/test', requireSuperAdmin, storageIntegrationController.testStorage);
router.get('/integrations/push', requireSuperAdmin, pushIntegrationController.getPush);
router.put('/integrations/push', requireSuperAdmin, pushIntegrationController.putPush);
router.post('/integrations/push/test', requireSuperAdmin, pushIntegrationController.testPush);

/** Table layout: user prefs + org default (super admin sets default) */
router.get('/table-layout/:tableId', settingsController.getTableLayout);
router.put('/table-layout/:tableId', settingsController.putUserTableLayout);
router.delete('/table-layout/:tableId', settingsController.deleteUserTableLayout);
router.put(
  '/table-layout/:tableId/default',
  authorize([ROLES.SUPER_ADMIN]),
  settingsController.putOrgTableLayoutDefault,
);

export default router;
