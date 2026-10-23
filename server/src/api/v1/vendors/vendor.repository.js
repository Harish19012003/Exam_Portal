import { pool } from '../../../database/connection.js';
import { AppError } from '../../../core/errors.js';
import { ERROR_CODES } from '@exam-view/shared';

export class VendorRepository {
  constructor() {
    this.tableName = 'vendors';
    this.pool = pool;
  }

  /**
   * Find a vendor by their primary key (vendor_code)
   * @param {string} vendorCode
   */
  async findByCode(vendorCode) {
    const [rows] = await this.pool.query(
      `SELECT * FROM ${this.tableName} WHERE vendor_code = ? LIMIT 1`,
      [vendorCode]
    );
    return rows[0] || null;
  }

  /**
   * List all vendors with optional search, filtering, and ordering
   * @param {object} queryOptions
   */
  async findAll({ search, status } = {}) {
    let sql = `SELECT * FROM ${this.tableName} WHERE 1=1`;
    const params = [];

    if (search) {
      sql += ` AND (vendor_code LIKE ? OR vendor_name LIKE ? OR email LIKE ? OR phone_number LIKE ?)`;
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }

    if (status) {
      sql += ` AND status = ?`;
      params.push(status);
    }

    sql += ` ORDER BY vendor_code ASC`;

    const [rows] = await this.pool.query(sql, params);
    return rows;
  }

  /**
   * Insert a new vendor
   * @param {object} data
   */
  async create(data) {
    const [result] = await this.pool.query(
      `INSERT INTO ${this.tableName} SET ?`,
      [data]
    );
    return result.affectedRows > 0;
  }

  /**
   * Update a vendor with optimistic concurrency control
   * @param {string} vendorCode
   * @param {object} data
   * @param {number} [version]
   */
  async update(vendorCode, data, version) {
    const updateData = { ...data };
    delete updateData.vendor_code; // Primary key cannot be changed

    // Normalize empty strings to null for nullable fields
    for (const [key, val] of Object.entries(updateData)) {
      if (val === '') {
        updateData[key] = null;
      }
    }

    if (version !== undefined && version !== null) {
      updateData.version = Number(version) + 1;
    }

    const keys = Object.keys(updateData);
    if (keys.length === 0) return true;

    const values = keys.map((k) => updateData[k]);
    const setClause = keys.map((k) => `${k} = ?`).join(', ');

    if (version !== undefined && version !== null) {
      const [result] = await this.pool.query(
        `UPDATE ${this.tableName} SET ${setClause} WHERE vendor_code = ? AND version = ?`,
        [...values, vendorCode, version]
      );

      if (result.affectedRows === 0) {
        const existing = await this.findByCode(vendorCode);
        if (!existing) {
          throw new AppError('Vendor not found', 404, ERROR_CODES.NOT_FOUND);
        }
        throw new AppError(
          'Vendor was modified by another user. Please refresh and try again.',
          409,
          ERROR_CODES.CONFLICT_VERSION_MISMATCH
        );
      }
      return true;
    }

    const [result] = await this.pool.query(
      `UPDATE ${this.tableName} SET ${setClause} WHERE vendor_code = ?`,
      [...values, vendorCode]
    );
    return result.affectedRows > 0;
  }

  /**
   * Delete a vendor by vendor_code
   * @param {string} vendorCode
   */
  async delete(vendorCode) {
    const [result] = await this.pool.query(
      `DELETE FROM ${this.tableName} WHERE vendor_code = ?`,
      [vendorCode]
    );
    return result.affectedRows > 0;
  }

  /**
   * Bulk insert or update vendor records (for seeding and data migration)
   * @param {Array<object>} vendors
   */
  async bulkUpsert(vendors) {
    if (!vendors || vendors.length === 0) return 0;
    
    let inserted = 0;
    for (const v of vendors) {
      const sql = `
        INSERT INTO ${this.tableName} (
          vendor_code, vendor_name, phone_number, email, status, version
        ) VALUES (?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          vendor_name = VALUES(vendor_name),
          phone_number = VALUES(phone_number),
          email = VALUES(email),
          status = VALUES(status),
          version = version + 1
      `;
      await this.pool.execute(sql, [
        v.vendor_code,
        v.vendor_name,
        v.phone_number || null,
        v.email || null,
        v.status || 'Active',
        v.version || 1,
      ]);
      inserted++;
    }
    return inserted;
  }
}

export const vendorRepository = new VendorRepository();
