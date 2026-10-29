import { Router } from 'express';
import * as seqViewController from './seq-view.controller.js';
import { authenticate } from '../../../core/auth.middleware.js';
import { withAccess } from '../../../core/access.js';

const router = Router();

// Group permissions (table actions, columns, row rules) are checked in the controller.
router.use(authenticate, withAccess);

// SeqView table config: custom fields (stored in seq_view_meta) + Feature Builder settings.
// Static paths are declared before '/:id'.
router.get('/config', seqViewController.getConfig);
router.put('/config', seqViewController.saveConfig);

router.get('/api-config', seqViewController.getApiConfig);
router.put('/api-config', seqViewController.saveApiConfig);
router.post('/api-config/test', seqViewController.testApiConfig);
router.post('/sync', seqViewController.syncFromApi);

router.post('/import', seqViewController.importSeqViews);
router.post('/delete', seqViewController.deleteSeqViews);

router.get('/', seqViewController.listSeqViews);
router.post('/', seqViewController.createSeqView);
router.get('/:id', seqViewController.getSeqView);
router.patch('/:id', seqViewController.updateSeqView);
router.put('/:id', seqViewController.updateSeqView);
router.delete('/:id', seqViewController.deleteSeqViews);

export default router;
