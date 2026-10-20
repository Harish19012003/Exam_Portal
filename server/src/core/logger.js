import env from '../config/env.js';

/**
 * Basic structured logger.
 * Phase 2 uses console, Phase 12 might replace with Winston/Pino.
 */
export const logger = {
  info: (message, meta = {}) => {
    console.log(JSON.stringify({ level: 'info', message, timestamp: new Date(), ...meta }));
  },
  warn: (message, meta = {}) => {
    console.warn(JSON.stringify({ level: 'warn', message, timestamp: new Date(), ...meta }));
  },
  error: (message, error = null, meta = {}) => {
    const errorDetails = error ? {
      errMessage: error.message,
      stack: env.NODE_ENV === 'development' ? error.stack : undefined
    } : {};
    console.error(JSON.stringify({ level: 'error', message, timestamp: new Date(), ...errorDetails, ...meta }));
  },
  debug: (message, meta = {}) => {
    if (env.NODE_ENV === 'development') {
      console.debug(JSON.stringify({ level: 'debug', message, timestamp: new Date(), ...meta }));
    }
  }
};
