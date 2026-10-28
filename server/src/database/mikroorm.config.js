import { defineConfig } from '@mikro-orm/mongodb';
import { entities } from './entities/index.js';
import env from '../config/env.js';

/**
 * MikroORM config — MongoDB driver now.
 * Later: swap clientUrl / driver for PostgreSQL without changing domain repos.
 */
export default defineConfig({
  clientUrl: env.MONGODB_URI,
  dbName: env.MONGODB_DB_NAME,
  entities,
  allowGlobalContext: true,
  debug: env.NODE_ENV === 'development' && process.env.MIKRO_ORM_DEBUG === '1',
});
