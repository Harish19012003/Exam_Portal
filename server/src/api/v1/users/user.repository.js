import { BaseRepository } from '../../../database/base.repository.js';

class UserRepository extends BaseRepository {
  constructor() {
    super('users');
  }

  /**
   * Find a user by email
   * @param {string} email 
   */
  async findByEmail(email) {
    const [rows] = await this.pool.query(
      `SELECT * FROM ${this.tableName} WHERE email = ? LIMIT 1`,
      [email]
    );
    return rows[0] || null;
  }

  /**
   * List all users
   */
  async findAll() {
    const [rows] = await this.pool.query(
      `SELECT id, email, phone_number, first_name, last_name, role, is_primary, status, permissions, two_factor_enabled, timezone, last_active_at, created_at, updated_at FROM ${this.tableName} ORDER BY is_primary DESC, role ASC, created_at ASC`
    );
    return rows;
  }

  /**
   * Update a user record directly
   */
  async update(id, data) {
    const keys = Object.keys(data);
    if (keys.length === 0) return true;
    const values = Object.values(data);
    const setClause = keys.map((k) => `${k} = ?`).join(', ');

    const [result] = await this.pool.query(
      `UPDATE ${this.tableName} SET ${setClause} WHERE id = ?`,
      [...values, id]
    );
    return result.affectedRows > 0;
  }
}

export const userRepository = new UserRepository();
