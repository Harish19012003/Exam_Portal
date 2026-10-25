import { pool } from '../../../database/connection.js';

let ensurePromise = null;

/** Created at runtime (mirrors ensureExamsTable); migration 014 holds the same DDL. */
export const ensurePresetTable = () => {
  if (!ensurePromise) {
    ensurePromise = pool
      .query(`
        CREATE TABLE IF NOT EXISTS exam_field_presets (
          id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(120) NOT NULL,
          service_value VARCHAR(191) NOT NULL,
          fields JSON NOT NULL,
          features JSON NULL,
          created_by VARCHAR(36) NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY uq_exam_field_presets_service (service_value)
        )
      `)
      .catch((error) => {
        ensurePromise = null;
        throw error;
      });
  }
  return ensurePromise;
};

const parseJson = (value, fallback) => {
  if (value == null) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const mapPreset = (row) => {
  const fields = parseJson(row.fields, []);
  return {
    id: row.id,
    name: row.name,
    serviceValue: row.service_value,
    fields,
    fieldCount: fields.length,
    features: parseJson(row.features, null),
    updatedAt: row.updated_at,
  };
};

export const listPresets = async () => {
  const [rows] = await pool.query('SELECT * FROM exam_field_presets ORDER BY name ASC');
  return rows.map(mapPreset);
};

export const findById = async (id) => {
  const [rows] = await pool.query('SELECT * FROM exam_field_presets WHERE id = ? LIMIT 1', [id]);
  return rows.length ? mapPreset(rows[0]) : null;
};

/** Service names compare case-insensitively (column collation). */
export const findByService = async (serviceValue) => {
  const [rows] = await pool.query(
    'SELECT * FROM exam_field_presets WHERE service_value = ? LIMIT 1',
    [serviceValue],
  );
  return rows.length ? mapPreset(rows[0]) : null;
};

export const insertPreset = async ({ name, serviceValue, fields, features, createdBy }) => {
  const [result] = await pool.query(
    `INSERT INTO exam_field_presets (name, service_value, fields, features, created_by)
     VALUES (?, ?, ?, ?, ?)`,
    [name, serviceValue, JSON.stringify(fields), features ? JSON.stringify(features) : null, createdBy || null],
  );
  return result.insertId;
};

export const updatePreset = async (id, { name, serviceValue, fields, features }) => {
  const [result] = await pool.query(
    `UPDATE exam_field_presets SET name = ?, service_value = ?, fields = ?, features = ? WHERE id = ?`,
    [name, serviceValue, JSON.stringify(fields), features ? JSON.stringify(features) : null, id],
  );
  return result.affectedRows > 0;
};

export const deletePreset = async (id) => {
  const [result] = await pool.query('DELETE FROM exam_field_presets WHERE id = ?', [id]);
  return result.affectedRows > 0;
};
