import { pool } from '../../../database/connection.js';
import { sqlTypeForDataType, encodeCellValue, decodeCellValue } from '../exams/exam.repository.js';

/** Physical system columns are prefixed so they can never collide with a builder field key. */
export const SYSTEM_COLUMNS = ['id', 'sys_created_by', 'sys_updated_by', 'sys_created_at', 'sys_updated_at'];

export const isSafeColumnName = (name) => /^[a-z][a-z0-9_]{0,39}$/.test(String(name || ''));
export const isReservedKey = (key) => key === 'id' || String(key).startsWith('sys_');

/** Dropdown/status with "allow multiple" behave as multi-select. */
export const effectiveType = (def) =>
  (def?.dataType === 'dropdown' || def?.dataType === 'status') && def?.allowMultiple
    ? 'multiselect'
    : def?.dataType || 'text';

export const columnSqlType = (def) => sqlTypeForDataType(effectiveType(def));

/** Physical table name is built from the numeric metadata id only. */
export const physicalTableName = (tableId) => {
  const id = Number(tableId);
  if (!Number.isInteger(id) || id <= 0) throw new Error('Invalid table id');
  return `exam_data_${id}`;
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

let ensurePromise = null;

const columnsOf = async (table) => {
  const [rows] = await pool.query(
    `SELECT COLUMN_NAME AS name FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [table],
  );
  return new Set(rows.map((r) => r.name));
};

/** Metadata tables are created at runtime (mirrors ensureExamsTable); migrations 012/013 hold the same DDL. */
export const ensureMetaTables = () => {
  if (!ensurePromise) {
    ensurePromise = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS exam_tables (
          id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
          exam_id VARCHAR(64) NOT NULL,
          created_by VARCHAR(36) NULL,
          features JSON NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY uq_exam_tables_exam (exam_id)
        )
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS exam_table_fields (
          id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
          table_id INT UNSIGNED NOT NULL,
          column_name VARCHAR(40) NOT NULL,
          label VARCHAR(120) NOT NULL,
          data_type VARCHAR(30) NOT NULL,
          is_required TINYINT(1) NOT NULL DEFAULT 0,
          options JSON NULL,
          definition JSON NULL,
          sort_order INT NOT NULL DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY uq_exam_table_fields_column (table_id, column_name),
          INDEX idx_exam_table_fields_order (table_id, sort_order),
          CONSTRAINT fk_exam_table_fields_table
            FOREIGN KEY (table_id) REFERENCES exam_tables(id) ON DELETE CASCADE
        )
      `);
      // Tables created before migration 013
      if (!(await columnsOf('exam_tables')).has('features')) {
        await pool.query('ALTER TABLE exam_tables ADD COLUMN features JSON NULL');
      }
      if (!(await columnsOf('exam_table_fields')).has('definition')) {
        await pool.query('ALTER TABLE exam_table_fields ADD COLUMN definition JSON NULL');
      }
    })().catch((error) => {
      ensurePromise = null;
      throw error;
    });
  }
  return ensurePromise;
};

/** Older exam tables used created_by/updated_by/...; rename once to the sys_ names. */
const upgradeSystemColumns = async (name) => {
  const cols = await columnsOf(name);
  if (cols.has('sys_created_by')) return;
  for (const base of ['created_by', 'updated_by', 'created_at', 'updated_at']) {
    if (cols.has(base)) await pool.query(`ALTER TABLE \`${name}\` RENAME COLUMN \`${base}\` TO \`sys_${base}\``);
  }
};

export const examExists = async (examId) => {
  const [rows] = await pool.query('SELECT id FROM exams WHERE id = ? LIMIT 1', [examId]);
  return rows.length > 0;
};

export const findTableByExamId = async (examId) => {
  const [rows] = await pool.query(
    'SELECT id, exam_id, features, created_at FROM exam_tables WHERE exam_id = ? LIMIT 1',
    [examId],
  );
  if (!rows.length) return null;
  const r = rows[0];
  const tableName = physicalTableName(r.id);
  await upgradeSystemColumns(tableName);
  return {
    id: r.id,
    examId: r.exam_id,
    tableName,
    features: parseJson(r.features, null),
    createdAt: r.created_at,
  };
};

export const createTable = async (examId, userId) => {
  const [result] = await pool.query(
    'INSERT INTO exam_tables (exam_id, created_by) VALUES (?, ?)',
    [examId, userId || null],
  );
  const tableId = result.insertId;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`${physicalTableName(tableId)}\` (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        sys_created_by VARCHAR(36) NULL,
        sys_updated_by VARCHAR(36) NULL,
        sys_created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        sys_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
  } catch (error) {
    await pool.query('DELETE FROM exam_tables WHERE id = ?', [tableId]);
    throw error;
  }
  return tableId;
};

export const dropTable = async (tableId) => {
  await pool.query(`DROP TABLE IF EXISTS \`${physicalTableName(tableId)}\``);
  await pool.query('DELETE FROM exam_tables WHERE id = ?', [tableId]);
};

/** Field definitions as the Fields drawer produced them, in saved order. */
export const listFields = async (tableId) => {
  const [rows] = await pool.query(
    'SELECT * FROM exam_table_fields WHERE table_id = ? ORDER BY sort_order ASC, id ASC',
    [tableId],
  );
  return rows.map((row) => ({
    ...parseJson(row.definition, {}),
    key: row.column_name,
    label: row.label,
    dataType: parseJson(row.definition, {}).dataType || row.data_type,
    order: row.sort_order,
  }));
};

/**
 * Make the physical table and metadata match `fields`. DDL auto-commits in MySQL, so this is
 * applied step by step: drops, then type changes, then new columns.
 */
export const applyFields = async (tableId, fields) => {
  const name = physicalTableName(tableId);
  const current = await listFields(tableId);
  const currentByKey = new Map(current.map((f) => [f.key, f]));
  const incomingKeys = new Set(fields.map((f) => f.key));

  for (const old of current) {
    if (incomingKeys.has(old.key)) continue;
    await pool.query(`ALTER TABLE \`${name}\` DROP COLUMN \`${old.key}\``);
    await pool.query('DELETE FROM exam_table_fields WHERE table_id = ? AND column_name = ?', [tableId, old.key]);
  }

  for (let i = 0; i < fields.length; i += 1) {
    const def = fields[i];
    const before = currentByKey.get(def.key);
    const options = Array.isArray(def.options) ? def.options : [];
    const meta = [def.label, def.dataType, def.required ? 1 : 0, options.length ? JSON.stringify(options) : null, JSON.stringify(def), i + 1];

    if (before) {
      if (columnSqlType(before) !== columnSqlType(def)) {
        await pool.query(`ALTER TABLE \`${name}\` MODIFY COLUMN \`${def.key}\` ${columnSqlType(def)}`);
      }
      await pool.query(
        `UPDATE exam_table_fields
            SET label = ?, data_type = ?, is_required = ?, options = ?, definition = ?, sort_order = ?
          WHERE table_id = ? AND column_name = ?`,
        [...meta, tableId, def.key],
      );
    } else {
      await pool.query(`ALTER TABLE \`${name}\` ADD COLUMN \`${def.key}\` ${columnSqlType(def)}`);
      await pool.query(
        `INSERT INTO exam_table_fields
           (table_id, column_name, label, data_type, is_required, options, definition, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [tableId, def.key, ...meta],
      );
    }
  }
};

export const saveFeatures = async (tableId, features) => {
  await pool.query('UPDATE exam_tables SET features = ? WHERE id = ?', [JSON.stringify(features), tableId]);
};

/* ---------- Rows ---------- */

const ROW_LIMIT = 1000;

const userLabel = (first, last, email) =>
  [first, last].filter(Boolean).join(' ').trim() || email || '';

const rowSelect = (tableId, fields) => {
  const cols = fields.map((f) => {
    if (!isSafeColumnName(f.key)) throw new Error('Unsafe column name');
    return `t.\`${f.key}\` AS \`c_${f.key}\``;
  });
  return `
    SELECT t.id, t.sys_created_at, t.sys_updated_at,
           cu.first_name AS cu_first, cu.last_name AS cu_last, cu.email AS cu_email,
           uu.first_name AS uu_first, uu.last_name AS uu_last, uu.email AS uu_email
           ${cols.length ? `, ${cols.join(', ')}` : ''}
    FROM \`${physicalTableName(tableId)}\` t
    LEFT JOIN users cu ON cu.id = t.sys_created_by
    LEFT JOIN users uu ON uu.id = t.sys_updated_by`;
};

const mapRow = (raw, fields) => {
  const created = userLabel(raw.cu_first, raw.cu_last, raw.cu_email);
  const values = {};
  fields.forEach((f) => {
    values[f.key] = decodeCellValue(raw[`c_${f.key}`], effectiveType(f));
  });
  return {
    id: String(raw.id),
    values,
    createdAt: raw.sys_created_at,
    updatedAt: raw.sys_updated_at,
    createdByLabel: created,
    updatedByLabel: userLabel(raw.uu_first, raw.uu_last, raw.uu_email) || created,
  };
};

export const listRows = async (tableId, fields) => {
  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM \`${physicalTableName(tableId)}\``);
  const [rows] = await pool.query(`${rowSelect(tableId, fields)} ORDER BY t.id DESC LIMIT ${ROW_LIMIT}`);
  return { rows: rows.map((r) => mapRow(r, fields)), total, limit: ROW_LIMIT };
};

export const findRow = async (tableId, fields, rowId) => {
  const [rows] = await pool.query(`${rowSelect(tableId, fields)} WHERE t.id = ? LIMIT 1`, [rowId]);
  return rows.length ? mapRow(rows[0], fields) : null;
};

/** `values` is already validated and holds only known field keys. */
export const insertRow = async (tableId, fields, values, userId) => {
  const cols = ['sys_created_by', 'sys_updated_by'];
  const params = [userId || null, userId || null];
  fields.forEach((f) => {
    if (!(f.key in values)) return;
    cols.push(`\`${f.key}\``);
    params.push(encodeCellValue(values[f.key], effectiveType(f)));
  });
  const [result] = await pool.query(
    `INSERT INTO \`${physicalTableName(tableId)}\` (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
    params,
  );
  return result.insertId;
};

export const updateRow = async (tableId, fields, rowId, values, userId) => {
  const sets = ['sys_updated_by = ?'];
  const params = [userId || null];
  fields.forEach((f) => {
    if (!(f.key in values)) return;
    sets.push(`\`${f.key}\` = ?`);
    params.push(encodeCellValue(values[f.key], effectiveType(f)));
  });
  params.push(rowId);
  const [result] = await pool.query(
    `UPDATE \`${physicalTableName(tableId)}\` SET ${sets.join(', ')} WHERE id = ?`,
    params,
  );
  return result.affectedRows > 0;
};

export const deleteRows = async (tableId, rowIds) => {
  const [result] = await pool.query(
    `DELETE FROM \`${physicalTableName(tableId)}\` WHERE id IN (?)`,
    [rowIds],
  );
  return result.affectedRows;
};
