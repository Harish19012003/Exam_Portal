import { MikroORM } from '@mikro-orm/mongodb';
import config from './mikroorm.config.js';
import { logger } from '../core/logger.js';

/** @type {import('@mikro-orm/mongodb').MikroORM | null} */
let orm = null;

export const getOrm = () => {
  if (!orm) throw new Error('ORM not initialized. Call initOrm() first.');
  return orm;
};

/** Request-scoped EntityManager fork (or global EM when allowGlobalContext). */
export const getEm = () => getOrm().em.fork();

export async function initOrm() {
  if (orm) return orm;
  orm = await MikroORM.init(config);
  return orm;
}

export async function closeOrm() {
  if (orm) {
    await orm.close(true);
    orm = null;
  }
}

/**
 * Tests the database connection with retry support.
 */
export async function testConnection(maxRetries = 5, retryDelayMs = 2000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await initOrm();
      // Force a round-trip; Mongo driver may report not connected until first command.
      await getOrm().em.getConnection().getDb().command({ ping: 1 });
      logger.info('✅ Successfully connected to MongoDB (MikroORM)');
      return true;
    } catch (error) {
      if (attempt === maxRetries) {
        logger.error('❌ Failed to connect to MongoDB after retries', error);
        process.exit(1);
      }
      logger.warn(
        `⚠️ MongoDB connection attempt ${attempt}/${maxRetries} failed. Retrying in ${retryDelayMs / 1000}s...`,
      );
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }
  }
}
