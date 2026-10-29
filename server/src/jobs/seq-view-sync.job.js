import { runScheduledSyncIfDue } from '../api/v1/seq-views/seq-view-api.service.js';
import { logger } from '../core/logger.js';

const TICK_MS = 60 * 1000;
let timer = null;
let ticking = false;

/**
 * Checks once a minute whether SeqView's API fetch is due. The interval itself is set by an admin in the
 * SeqView API dialog. Runs in this process only, so run a single server instance (or move this to a worker).
 */
export const startSeqViewSyncJob = () => {
  if (timer) return;
  timer = setInterval(async () => {
    if (ticking) return;
    ticking = true;
    try {
      await runScheduledSyncIfDue();
    } catch (error) {
      logger.error('[seq-view] Scheduler tick failed', error);
    } finally {
      ticking = false;
    }
  }, TICK_MS);
  timer.unref();
};

export const stopSeqViewSyncJob = () => {
  clearInterval(timer);
  timer = null;
};
