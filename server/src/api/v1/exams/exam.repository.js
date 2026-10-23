import { pool } from '../../../database/connection.js';

const parseJson = (value, fallback) => {
  if (value == null) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const mapRow = (row) => {
  if (!row) return null;
  const createdAt = row.created_at ? new Date(row.created_at).getTime() : null;
  const updatedAt = row.updated_at ? new Date(row.updated_at).getTime() : null;
  return {
    id: row.id,
    values: parseJson(row.form_values, {}),
    fields: parseJson(row.fields_snapshot, []),
    createdBy: row.created_by || null,
    createdAt,
    updatedAt,
  };
};

let ensurePromise = null;

/** Idempotent — creates `exams` if missing (safe if migrate not run yet). */
export const ensureExamsTable = async () => {
  if (!ensurePromise) {
    ensurePromise = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS exams (
          id VARCHAR(64) NOT NULL PRIMARY KEY,
          form_values JSON NOT NULL,
          fields_snapshot JSON NOT NULL,
          created_by VARCHAR(36) NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_exams_created_at (created_at),
          INDEX idx_exams_created_by (created_by)
        )
      `);
    })().catch((err) => {
      ensurePromise = null;
      throw err;
    });
  }
  return ensurePromise;
};

export const findAll = async () => {
  await ensureExamsTable();
  const [rows] = await pool.query(
    `SELECT id, form_values, fields_snapshot, created_by, created_at, updated_at
     FROM exams
     ORDER BY created_at DESC`,
  );
  return rows.map(mapRow);
};

export const findById = async (id) => {
  await ensureExamsTable();
  const [rows] = await pool.query(
    `SELECT id, form_values, fields_snapshot, created_by, created_at, updated_at
     FROM exams WHERE id = ? LIMIT 1`,
    [id],
  );
  return mapRow(rows[0]);
};

export const create = async ({ id, values, fields, createdBy }) => {
  await ensureExamsTable();
  await pool.query(
    `INSERT INTO exams (id, form_values, fields_snapshot, created_by)
     VALUES (?, ?, ?, ?)`,
    [
      id,
      JSON.stringify(values ?? {}),
      JSON.stringify(Array.isArray(fields) ? fields : []),
      createdBy || null,
    ],
  );
  return findById(id);
};

export const update = async (id, { values, fields }) => {
  const existing = await findById(id);
  if (!existing) return null;

  const nextValues =
    values && typeof values === 'object' ? { ...existing.values, ...values } : existing.values;
  const nextFields = Array.isArray(fields) ? fields : existing.fields;

  await pool.query(
    `UPDATE exams
     SET form_values = ?, fields_snapshot = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [JSON.stringify(nextValues), JSON.stringify(nextFields), id],
  );
  return findById(id);
};

export const remove = async (id) => {
  await ensureExamsTable();
  const [result] = await pool.query(`DELETE FROM exams WHERE id = ?`, [id]);
  return result.affectedRows > 0;
};

export const upsert = async ({ id, values, fields, createdBy }) => {
  await ensureExamsTable();
  await pool.query(
    `INSERT INTO exams (id, form_values, fields_snapshot, created_by)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       form_values = VALUES(form_values),
       fields_snapshot = VALUES(fields_snapshot),
       updated_at = CURRENT_TIMESTAMP`,
    [
      id,
      JSON.stringify(values ?? {}),
      JSON.stringify(Array.isArray(fields) ? fields : []),
      createdBy || null,
    ],
  );
  return findById(id);
};
