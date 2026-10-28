import { ObjectId } from '@mikro-orm/mongodb';
import { getEm } from '../../../database/connection.js';
import { Vendor } from '../../../database/entities/index.js';
import { AppError } from '../../../core/errors.js';
import { ERROR_CODES } from '@exam-view/shared';

/**
 * Vendor documents are flat: system fields plus one top-level key per custom field.
 * Documents written before this change keep their values under `values`; they are still
 * read (flattened) and are rewritten flat the next time they are edited.
 */
const toApi = (doc) => {
  if (!doc) return null;
  const { _id, version, created_at, updated_at, values, ...flat } = doc;
  return {
    id: String(_id),
    version: version ?? 1,
    created_at,
    updated_at,
    ...(values && typeof values === 'object' ? values : {}),
    ...flat,
  };
};

const affected = (res) => {
  if (typeof res === 'number') return res;
  return res?.affectedRows ?? res?.modifiedCount ?? res?.matchedCount ?? null;
};

export class VendorRepository {
  async #findRaw(id) {
    const em = getEm();
    const [doc] = await em.aggregate(Vendor, [{ $match: { _id: new ObjectId(String(id)) } }]);
    return doc || null;
  }

  async findById(id) {
    return toApi(await this.#findRaw(id));
  }

  async findAll() {
    const em = getEm();
    const docs = await em.aggregate(Vendor, [{ $sort: { created_at: -1 } }]);
    return docs.map(toApi);
  }

  /** @param {object} data flat custom field values (already validated/encoded) */
  async create(data) {
    const em = getEm();
    const now = new Date();
    const insertedId = await em.insert(Vendor, { ...(data || {}), version: 1, created_at: now, updated_at: now });
    return String(insertedId);
  }

  async createMany(list) {
    const em = getEm();
    const now = new Date();
    await em.insertMany(
      Vendor,
      list.map((data) => ({ ...(data || {}), version: 1, created_at: now, updated_at: now })),
    );
    return list.length;
  }

  async update(id, data, version) {
    const em = getEm();
    const doc = await this.#findRaw(id);
    if (!doc) throw new AppError('Vendor not found', 404, ERROR_CODES.NOT_FOUND);

    const current = doc.version ?? 1;
    const conflict = () =>
      new AppError(
        'Vendor was modified by another user. Please refresh and try again.',
        409,
        ERROR_CODES.CONFLICT_VERSION_MISMATCH,
      );
    if (version !== undefined && version !== null && version !== current) throw conflict();

    const legacy = doc.values && typeof doc.values === 'object' ? doc.values : null;
    const update = {
      $set: { ...(legacy || {}), ...(data || {}), version: current + 1, updated_at: new Date() },
    };
    if (doc.values !== undefined) update.$unset = { values: '' };

    const where = { _id: doc._id, ...(doc.version !== undefined ? { version: doc.version } : {}) };
    const n = affected(await em.nativeUpdate(Vendor, where, update));
    if (n === 0) throw conflict();
    return true;
  }

  async deleteMany(ids) {
    const em = getEm();
    const list = (ids || []).map((v) => new ObjectId(String(v)));
    return em.nativeDelete(Vendor, { _id: { $in: list } });
  }
}

export const vendorRepository = new VendorRepository();
