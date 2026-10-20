import { pool } from './connection.js';
import { AppError } from '../core/errors.js';
import { ERROR_CODES } from '@exam-view/shared';

/**
 * Base repository providing standard CRUD operations.
 * Extend this class for specific entities.
 */
export class BaseRepository {
  /**
   * @param {string} tableName
   */
  constructor(tableName) {
    this.tableName = tableName;
    this.pool = pool;
  }

  /**
   * Finds a record by ID.
   */
  async findById(id) {
    const [rows] = await this.pool.query(
      `SELECT * FROM ${this.tableName} WHERE id = ? LIMIT 1`,
      [id]
    );
    return rows[0] || null;
  }

  /**
   * Creates a new record.
   */
  async create(data) {
    const [result] = await this.pool.query(
      `INSERT INTO ${this.tableName} SET ?`,
      [data]
    );
    return result.insertId;
  }

  /**
   * Updates a record with optimistic locking.
   * Requires `version` column in the database and in the input `data`.
   */
  async updateWithLock(id, version, data) {
    // We increment version on successful update
    const updateData = { ...data, version: version + 1 };
    
    // Build SET clause dynamically
    const keys = Object.keys(updateData);
    const values = Object.values(updateData);
    const setClause = keys.map(k => `${k} = ?`).join(', ');

    const [result] = await this.pool.query(
      `UPDATE ${this.tableName} SET ${setClause} WHERE id = ? AND version = ?`,
      [...values, id, version]
    );

    if (result.affectedRows === 0) {
      // Could mean the record doesn't exist, OR the version mismatched
      const exists = await this.findById(id);
      if (!exists) {
        throw new AppError('Record not found', 404, ERROR_CODES.NOT_FOUND);
      }
      throw new AppError(
        'The record was updated by another user. Please refresh and try again.',
        409,
        ERROR_CODES.CONFLICT_VERSION_MISMATCH
      );
    }
    
    return true;
  }

  /**
   * Deletes a record by ID.
   */
  async delete(id) {
    const [result] = await this.pool.query(
      `DELETE FROM ${this.tableName} WHERE id = ?`,
      [id]
    );
    return result.affectedRows > 0;
  }
}
