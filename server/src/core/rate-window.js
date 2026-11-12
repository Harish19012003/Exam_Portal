import { ERROR_CODES } from '@exam-view/shared';
import { AppError } from './errors.js';

/**
 * Tiny in-memory sliding-window limiter keyed by user id. Enough to stop an admin-only "test"
 * button being hammered; resets on restart, which is fine for that purpose.
 */
export const createRateWindow = (max, windowMs, message) => {
  const hits = new Map();
  return (key) => {
    const now = Date.now();
    const recent = (hits.get(key) || []).filter((t) => now - t < windowMs);
    if (recent.length >= max) {
      throw new AppError(message, 429, ERROR_CODES.RATE_LIMITED);
    }
    recent.push(now);
    hits.set(key, recent);
  };
};
