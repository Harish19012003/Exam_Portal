import { BaseRepository } from '../../../database/base.repository.js';
import { User } from '../../../database/entities/index.js';

class UserRepository extends BaseRepository {
  constructor() {
    super(User, { idField: '_id' });
  }

  async findByEmail(email) {
    const row = await this.repo().findOne({ email });
    return row ? this.toPlain(row) : null;
  }

  async findAll() {
    const rows = await this.repo().findAll({
      orderBy: [{ is_primary: 'DESC' }, { role: 'ASC' }, { created_at: 'ASC' }],
    });
    return rows.map((r) => {
      const plain = this.toPlain(r);
      const { password_hash, ...safe } = plain;
      return {
        ...safe,
        id: String(r._id),
      };
    });
  }

  async findById(id) {
    const row = await this.repo().findOne({ _id: String(id) });
    return row ? this.toPlain(row) : null;
  }

  async create(data) {
    const em = this.em();
    const payload = { ...data };
    if (payload.id && !payload._id) {
      payload._id = payload.id;
      delete payload.id;
    }
    if (typeof payload.permissions === 'string') {
      try {
        payload.permissions = JSON.parse(payload.permissions);
      } catch {
        payload.permissions = [];
      }
    }
    payload.is_primary = Boolean(payload.is_primary);
    payload.two_factor_enabled = Boolean(payload.two_factor_enabled);
    const entity = em.create(User, payload);
    await em.persist(entity).flush();
    return this.toPlain(entity);
  }

  async update(id, data) {
    const em = this.em();
    const entity = await em.findOne(User, { _id: String(id) });
    if (!entity) return false;
    const payload = { ...data };
    if (typeof payload.permissions === 'string') {
      try {
        payload.permissions = JSON.parse(payload.permissions);
      } catch {
        // keep string only if parse fails — prefer array
      }
    }
    if (payload.two_factor_enabled !== undefined) {
      payload.two_factor_enabled = Boolean(payload.two_factor_enabled);
    }
    if (payload.is_primary !== undefined) {
      payload.is_primary = Boolean(payload.is_primary);
    }
    em.assign(entity, payload);
    await em.flush();
    return true;
  }

  toPlain(entity) {
    if (!entity) return null;
    return {
      id: String(entity._id),
      email: entity.email,
      password_hash: entity.password_hash,
      first_name: entity.first_name,
      last_name: entity.last_name,
      phone_number: entity.phone_number || null,
      role: entity.role,
      status: entity.status,
      is_primary: Boolean(entity.is_primary),
      permissions: entity.permissions,
      two_factor_enabled: Boolean(entity.two_factor_enabled),
      timezone: entity.timezone || 'UTC',
      last_active_at: entity.last_active_at || null,
      created_at: entity.created_at,
      updated_at: entity.updated_at,
    };
  }
}

export const userRepository = new UserRepository();
