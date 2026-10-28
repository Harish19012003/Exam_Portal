import { initOrm, closeOrm, getOrm } from './connection.js';

/**
 * Ensure Mongo database + indexes exist (idempotent).
 * Replaces the old SQL migration runner.
 */
async function migrate() {
  console.log('🔄 Connecting to MongoDB via MikroORM...');
  await initOrm();
  const orm = getOrm();

  console.log('📇 Ensuring database + indexes...');
  await orm.schema.ensureDatabase();
  try {
    await orm.schema.ensureIndexes();
  } catch (error) {
    // Index already exists with different options (common on re-run) — treat as OK.
    const msg = String(error?.message || error);
    if (!/same name as the requested index|IndexKeySpecsConflict|already exists/i.test(msg)) {
      throw error;
    }
    console.warn('⚠️ Some indexes already exist; continuing.');
  }

  console.log('✅ MongoDB schema/indexes ready.');
  await closeOrm();
}

migrate().catch(async (err) => {
  console.error('❌ Migration failed:', err.message);
  console.error(err);
  try {
    await closeOrm();
  } catch {
    // ignore
  }
  process.exit(1);
});
