import { ObjectId } from '@mikro-orm/mongodb';
import { getEm } from '../../../database/connection.js';
import { SeqView } from '../../../database/entities/index.js';
import { AppError } from '../../../core/errors.js';
import { ERROR_CODES } from '@exam-view/shared';

/** SeqView documents are flat: system fields plus one top-level key per custom field. */
const toApi = (doc) => {
  if (!doc) return null;
  const { _id, version, created_at, updated_at, ...flat } = doc;
  return { id: String(_id), version: version ?? 1, created_at, updated_at, ...flat };
};

const affected = (res) => {
  if (typeof res === 'number') return res;
  return res?.affectedRows ?? res?.modifiedCount ?? res?.matchedCount ?? null;
};

export class SeqViewRepository {
  async #findRaw(id) {
    const em = getEm();
    const [doc] = await em.aggregate(SeqView, [{ $match: { _id: new ObjectId(String(id)) } }]);
    return doc || null;
  }

  async findById(id) {
    return toApi(await this.#findRaw(id));
  }

  async findAll() {
    const em = getEm();
    const docs = await em.aggregate(SeqView, [{ $sort: { created_at: -1 } }]);
    return docs.map(toApi);
  }

  /** @param {object} data flat custom field values (already validated/encoded) */
  async create(data) {
    const em = getEm();
    const now = new Date();
    const insertedId = await em.insert(SeqView, { ...(data || {}), version: 1, created_at: now, updated_at: now });
    return String(insertedId);
  }

  async createMany(list) {
    const em = getEm();
    const now = new Date();
    await em.insertMany(
      SeqView,
      list.map((data) => ({ ...(data || {}), version: 1, created_at: now, updated_at: now })),
    );
    return list.length;
  }

  async update(id, data, version) {
    const em = getEm();
    const doc = await this.#findRaw(id);
    if (!doc) throw new AppError('SeqView not found', 404, ERROR_CODES.NOT_FOUND);

    const current = doc.version ?? 1;
    const conflict = () =>
      new AppError(
        'SeqView was modified by another user. Please refresh and try again.',
        409,
        ERROR_CODES.CONFLICT_VERSION_MISMATCH,
      );
    if (version !== undefined && version !== null && version !== current) throw conflict();

    const update = { $set: { ...(data || {}), version: current + 1, updated_at: new Date() } };

    const where = { _id: doc._id, ...(doc.version !== undefined ? { version: doc.version } : {}) };
    const n = affected(await em.nativeUpdate(SeqView, where, update));
    if (n === 0) throw conflict();
    return true;
  }

  async deleteMany(ids) {
    const em = getEm();
    const list = (ids || []).map((v) => new ObjectId(String(v)));
    return em.nativeDelete(SeqView, { _id: { $in: list } });
  }
}

export const seqViewRepository = new SeqViewRepository();
