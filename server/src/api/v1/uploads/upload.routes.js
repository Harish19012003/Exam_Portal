import { Router } from 'express';
import { authenticate } from '../../../core/auth.middleware.js';
import * as uploadController from './upload.controller.js';

const router = Router();

router.post('/signature', authenticate, uploadController.getAttachmentUploadSignature);

export default router;
