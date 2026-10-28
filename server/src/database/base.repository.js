import { getEm } from './connection.js';
import { AppError } from '../core/errors.js';
import { ERROR_CODES } from '@exam-view/shared';

/**
 * Thin ORM-backed base repository.
 * Subclasses set `this.entity` to a MikroORM entity class.
 */
export class BaseRepository {
  /**
   * @param {Function} entityClass
   * @param {{ idField?: string }} [options]
   */
  constructor(entityClass, options = {}) {
    this.entity = entityClass;
    /** Primary key property on the entity (`_id` for string UUID entities, `id` for ObjectId+serialized). */
    this.idField = options.idField || '_id';
  }

  em() {
    return getEm();
  }

  repo() {
    return this.em().getRepository(this.entity);
  }

  async findById(id) {
    if (id == null) return null;
    const where = this.idField === 'id' ? { id: String(id) } : { _id: String(id) };
    const row = await this.repo().findOne(where);
    return row ? this.toPlain(row) : null;
  }

  async create(data) {
    const em = this.em();
    const entity = em.create(this.entity, data);
    await em.persist(entity).flush();
    return this.toPlain(entity);
  }

  async updateWithLock(id, version, data) {
    const em = this.em();
    const where = this.idField === 'id' ? { id: String(id), version } : { _id: String(id), version };
    const entity = await em.findOne(this.entity, where);
    if (!entity) {
      const exists = await this.findById(id);
      if (!exists) throw new AppError('Record not found', 404, ERROR_CODES.NOT_FOUND);
      throw new AppError(
        'The record was updated by another user. Please refresh and try again.',
        409,
        ERROR_CODES.CONFLICT_VERSION_MISMATCH,
      );
    }
    em.assign(entity, { ...data, version: version + 1 });
    await em.flush();
    return true;
  }

  async delete(id) {
    const em = this.em();
    const where = this.idField === 'id' ? { id: String(id) } : { _id: String(id) };
    const entity = await em.findOne(this.entity, where);
    if (!entity) return false;
    await em.remove(entity).flush();
    return true;
  }

  /** Serialize entity for API (string id, strip internals). */
  toPlain(entity) {
    if (!entity) return null;
    const plain = { ...entity };
    if (plain._id != null && plain.id == null) plain.id = String(plain._id);
    if (plain.id != null) plain.id = String(plain.id);
    return plain;
  }
}
