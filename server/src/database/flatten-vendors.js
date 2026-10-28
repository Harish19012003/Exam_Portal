/**
 * One-off: rewrite vendor documents from `{ values: { k: v } }` to flat `{ k: v }`.
 * Safe to re-run (documents without `values` are skipped). Not part of db:migrate.
 *
 *   node src/database/flatten-vendors.js
 */
import { initOrm, closeOrm, getEm } from './connection.js';
import { Vendor } from './entities/index.js';

await initOrm();
try {
  const em = getEm();
  const docs = await em.aggregate(Vendor, [{ $match: { values: { $type: 'object' } } }]);
  for (const doc of docs) {
    await em.nativeUpdate(Vendor, { _id: doc._id }, { $set: { ...doc.values }, $unset: { values: '' } });
  }
  console.log(`Flattened ${docs.length} vendor document(s).`);
} finally {
  await closeOrm();
}
