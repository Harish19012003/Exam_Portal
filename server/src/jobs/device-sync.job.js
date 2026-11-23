import { runScheduledSyncIfDue } from '../api/v1/devices/device-api.service.js';
import { logger } from '../core/logger.js';

const TICK_MS = 60 * 1000;
let timer = null;
let ticking = false;

/**
 * Checks once a minute whether Device Master's API fetch is due. The interval itself is set by an admin in the
 * Device API dialog. Runs in this process only, so run a single server instance (or move this to a worker).
 */
export const startDeviceSyncJob = () => {
  if (timer) return;
  timer = setInterval(async () => {
    if (ticking) return;
    ticking = true;
    try {
      await runScheduledSyncIfDue();
    } catch (error) {
      logger.error('[devices] Scheduler tick failed', error);
    } finally {
      ticking = false;
    }
  }, TICK_MS);
  timer.unref();
};

export const stopDeviceSyncJob = () => {
  clearInterval(timer);
  timer = null;
};
