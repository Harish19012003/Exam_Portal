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

  /**
   * People who have at least one of `tagIds` (Mongo array $in).
   * Optional `search` filters name / email / user_code. Supports page+limit for the picker.
   */
  async findAssignableByTagIds(tagIds = [], { search = '', page = 1, limit = 40, all = false } = {}) {
    const wanted = [...new Set((tagIds || []).map(String).filter(Boolean))];
    if (!wanted.length) {
      return { rows: [], total: 0, page: 1, limit: 0, hasMore: false };
    }

    const filter = {
      tag_ids: { $in: wanted },
      // Missing status counts as active; only drop explicitly disabled accounts.
      status: { $nin: ['disabled', 'Disabled'] },
    };
    const q = String(search || '').trim();
    if (q) {
      const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const tokens = q.split(/\s+/).map(escapeRe).filter(Boolean);
      const fieldMatch = (re) => ({
        $or: [{ first_name: re }, { last_name: re }, { email: re }, { user_code: re }],
      });
      if (tokens.length <= 1) {
        Object.assign(filter, fieldMatch(new RegExp(tokens[0] || escapeRe(q), 'i')));
      } else {
        // "Aadarsh Mishra" → each token must hit name / email / code somewhere.
        filter.$and = tokens.map((tok) => fieldMatch(new RegExp(tok, 'i')));
      }
    }

    const fields = ['email', 'first_name', 'last_name', 'user_code', 'tag_ids', 'status'];
    const orderBy = { first_name: 'ASC', email: 'ASC' };
    const total = await this.repo().count(filter);

    if (all) {
      const rows = await this.repo().find(filter, {
        fields,
        orderBy,
        limit: Math.min(total || 10000, 10000),
      });
      const mapped = rows.map((r) => {
        const plain = this.toPlain(r);
        const { password_hash, ...safe } = plain;
        return { ...safe, id: String(r._id) };
      });
      return { rows: mapped, total: mapped.length, page: 1, limit: mapped.length, hasMore: false };
    }

    const pageNum = Math.max(1, Number.parseInt(page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, Number.parseInt(limit, 10) || 40));
    const offset = (pageNum - 1) * pageSize;
    const rows = await this.repo().find(filter, {
      fields,
      orderBy,
      limit: pageSize,
      offset,
    });
    const mapped = rows.map((r) => {
      const plain = this.toPlain(r);
      const { password_hash, ...safe } = plain;
      return { ...safe, id: String(r._id) };
    });
    return {
      rows: mapped,
      total,
      page: pageNum,
      limit: pageSize,
      hasMore: offset + mapped.length < total,
    };
  }

  /** Resolve a small set of user ids for assignee chips (no full-table scan). */
  async findAssignableByIds(ids = []) {
    const wanted = [...new Set((ids || []).map(String).filter(Boolean))];
    if (!wanted.length) return [];
    const rows = await this.repo().find(
      { _id: { $in: wanted } },
      { fields: ['email', 'first_name', 'last_name', 'user_code', 'tag_ids', 'status'] },
    );
    return rows.map((r) => {
      const plain = this.toPlain(r);
      const { password_hash, ...safe } = plain;
      return { ...safe, id: String(r._id) };
    });
  }

  async findById(id) {
    const row = await this.repo().findOne({ _id: String(id) });
    return row ? this.toPlain(row) : null;
  }

  _normalizeCreatePayload(data) {
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
    return payload;
  }

  async create(data) {
    const em = this.em();
    const entity = em.create(User, this._normalizeCreatePayload(data));
    await em.persist(entity).flush();
    return this.toPlain(entity);
  }

  /** Insert many users with one flush (used by bulk import). */
  async createMany(items = []) {
    if (!Array.isArray(items) || !items.length) return [];
    const em = this.em();
    const entities = items.map((data) => em.create(User, this._normalizeCreatePayload(data)));
    await em.persist(entities).flush();
    return entities.map((entity) => this.toPlain(entity));
  }

  /** Emails only — used to skip per-row uniqueness lookups during bulk import. */
  async listEmails() {
    const rows = await this.repo().findAll({ fields: ['email'] });
    return rows.map((r) => String(r.email || '').trim().toLowerCase()).filter(Boolean);
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
      user_code: entity.user_code || null,
      role: entity.role,
      status: entity.status,
      is_primary: Boolean(entity.is_primary),
      permissions: entity.permissions,
      access_overrides: entity.access_overrides || null,
      tag_ids: Array.isArray(entity.tag_ids) ? entity.tag_ids.map(String) : [],
      two_factor_enabled: Boolean(entity.two_factor_enabled),
      timezone: entity.timezone || 'UTC',
      avatar_url: entity.avatar_url || null,
      avatar_public_id: entity.avatar_public_id || null,
      last_active_at: entity.last_active_at || null,
      created_at: entity.created_at,
      updated_at: entity.updated_at,
    };
  }
}

export const userRepository = new UserRepository();
