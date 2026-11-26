import { ObjectId } from '@mikro-orm/mongodb';
import { getEm } from '../../../database/connection.js';
import { Device } from '../../../database/entities/index.js';
import { AppError } from '../../../core/errors.js';
import { ERROR_CODES } from '@exam-view/shared';

/**
 * Param rows in `device_param`: system fields plus one top-level key per custom field.
 * Each row belongs to one bio exam via `exam_id`.
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

export class DeviceRepository {
  async #findRaw(id) {
    const em = getEm();
    const [doc] = await em.aggregate(Device, [{ $match: { _id: new ObjectId(String(id)) } }]);
    return doc || null;
  }

  async findById(id) {
    return toApi(await this.#findRaw(id));
  }

  async findAll() {
    const em = getEm();
    const docs = await em.aggregate(Device, [{ $sort: { created_at: -1 } }]);
    return docs.map(toApi);
  }

  async findByExamId(examId) {
    const em = getEm();
    const id = String(examId || '').trim();
    if (!id) return [];
    const docs = await em.aggregate(Device, [
      { $match: { exam_id: id } },
      { $sort: { created_at: -1 } },
    ]);
    return docs.map(toApi);
  }

  /** @param {object} data flat custom field values (already validated/encoded) */
  async create(data) {
    const em = getEm();
    const now = new Date();
    const insertedId = await em.insert(Device, { ...(data || {}), version: 1, created_at: now, updated_at: now });
    return String(insertedId);
  }

  async createMany(list) {
    const em = getEm();
    const now = new Date();
    await em.insertMany(
      Device,
      list.map((data) => ({ ...(data || {}), version: 1, created_at: now, updated_at: now })),
    );
    return list.length;
  }

  async update(id, data, version) {
    const em = getEm();
    const doc = await this.#findRaw(id);
    if (!doc) throw new AppError('Device not found', 404, ERROR_CODES.NOT_FOUND);

    const current = doc.version ?? 1;
    const conflict = () =>
      new AppError(
        'Device was modified by another user. Please refresh and try again.',
        409,
        ERROR_CODES.CONFLICT_VERSION_MISMATCH,
      );
    if (version !== undefined && version !== null && version !== current) throw conflict();

    const legacy = doc.values && typeof doc.values === 'object' ? doc.values : null;
    const { exam_id: _ignoreExamId, ...safeData } = data || {};
    const update = {
      $set: { ...(legacy || {}), ...safeData, version: current + 1, updated_at: new Date() },
    };
    if (doc.values !== undefined) update.$unset = { values: '' };

    const where = { _id: doc._id, ...(doc.version !== undefined ? { version: doc.version } : {}) };
    const n = affected(await em.nativeUpdate(Device, where, update));
    if (n === 0) throw conflict();
    return true;
  }

  async deleteMany(ids) {
    const em = getEm();
    const list = (ids || []).map((v) => new ObjectId(String(v)));
    return em.nativeDelete(Device, { _id: { $in: list } });
  }
}

export const deviceRepository = new DeviceRepository();
