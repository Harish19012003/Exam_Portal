import { pool } from '../../../database/connection.js';

const SYSTEM_COLUMNS = new Set([
  'id',
  'created_by',
  'updated_by',
  'created_at',
  'updated_at',
]);

const formatUserLabel = (firstName, lastName, email) => {
  const name = [firstName, lastName].filter(Boolean).join(' ').trim();
  return name || email || null;
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

/** Only allow safe MySQL identifiers that match field keys */
export const isSafeColumnName = (key) => /^[a-z][a-z0-9_]{0,39}$/.test(String(key || ''));

export const sqlTypeForDataType = (dataType) => {
  switch (dataType) {
    case 'number':
    case 'currency':
    case 'progress':
    case 'rating':
      return 'DOUBLE NULL';
    case 'date':
      return 'DATE NULL';
    case 'datetime':
      return 'DATETIME NULL';
    case 'time':
      return 'TIME NULL';
    case 'boolean':
    case 'checkbox':
    case 'dot':
      return 'TINYINT(1) NULL DEFAULT 0';
    case 'multiselect':
    case 'tags':
    case 'attachment':
      return 'TEXT NULL';
    case 'formula':
    case 'composite':
    case 'code':
    case 'mono':
      return 'TEXT NULL';
    default:
      return 'VARCHAR(500) NULL';
  }
};

export const encodeCellValue = (value, dataType) => {
  if (value === undefined) return null;
  if (value === null || value === '') return null;

  if (dataType === 'boolean' || dataType === 'checkbox' || dataType === 'dot') {
    return value === true || value === 1 || value === '1' || value === 'true' ? 1 : 0;
  }

  if (dataType === 'multiselect' || dataType === 'tags' || dataType === 'attachment') {
    if (Array.isArray(value)) return value.map(String).join('\u001f');
    return String(value);
  }

  if (dataType === 'number' || dataType === 'currency' || dataType === 'progress' || dataType === 'rating') {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  if (dataType === 'datetime' && typeof value === 'string' && value.includes('T') && !value.includes(' ')) {
    return value.replace('T', ' ').slice(0, 19);
  }

  return value;
};

export const decodeCellValue = (value, dataType) => {
  if (value == null) {
    if (dataType === 'boolean' || dataType === 'checkbox' || dataType === 'dot') return false;
    if (dataType === 'multiselect' || dataType === 'tags' || dataType === 'attachment') return [];
    return '';
  }

  if (dataType === 'boolean' || dataType === 'checkbox' || dataType === 'dot') {
    return value === 1 || value === true || value === '1';
  }

  if (dataType === 'multiselect' || dataType === 'tags' || dataType === 'attachment') {
    if (Array.isArray(value)) return value;
    const raw = String(value);
    if (!raw) return [];
    return raw.includes('\u001f')
      ? raw.split('\u001f')
      : raw.split(',').map((s) => s.trim()).filter(Boolean);
  }

  if (dataType === 'datetime' && value instanceof Date) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
  }

  if (dataType === 'datetime' && typeof value === 'string' && /^\d{4}-\d{2}-\d{2} /.test(value)) {
    return value.replace(' ', 'T').slice(0, 16);
  }

  if (dataType === 'date' && value instanceof Date) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
  }

  return value;
};

let ensurePromise = null;
let fieldTypeMapCache = new Map();

const listTableColumns = async () => {
  const [rows] = await pool.query(
    `SELECT COLUMN_NAME AS name
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'exams'`,
  );
  return rows.map((r) => r.name);
};

const dropLegacyJsonColumns = async () => {
  const cols = new Set(await listTableColumns());
  if (cols.has('form_values')) {
    try {
      await pool.query('ALTER TABLE exams DROP COLUMN form_values');
    } catch {
      // ignore
    }
  }
  if (cols.has('fields_snapshot')) {
    try {
      await pool.query('ALTER TABLE exams DROP COLUMN fields_snapshot');
    } catch {
      // ignore
    }
  }
};

export const ensureExamsTable = async () => {
  if (!ensurePromise) {
    ensurePromise = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS exams (
          id VARCHAR(64) NOT NULL PRIMARY KEY,
          created_by VARCHAR(36) NULL,
          updated_by VARCHAR(36) NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_exams_created_at (created_at),
          INDEX idx_exams_created_by (created_by)
        )
      `);
      await dropLegacyJsonColumns();
      const cols = new Set(await listTableColumns());
      if (!cols.has('updated_by')) {
        try {
          await pool.query(
            'ALTER TABLE exams ADD COLUMN updated_by VARCHAR(36) NULL AFTER created_by',
          );
        } catch {
          // ignore
        }
      }
    })().catch((err) => {
      ensurePromise = null;
      throw err;
    });
  }
  return ensurePromise;
};

/**
 * Ensure each field key exists as a real SQL column on `exams`.
 * Does not drop columns (keeps historical data if a field is removed from config).
 */
export const syncFieldColumns = async (fields = []) => {
  await ensureExamsTable();
  const existing = new Set(await listTableColumns());
  const typeMap = new Map(fieldTypeMapCache);

  for (const field of Array.isArray(fields) ? fields : []) {
    const key = field?.key;
    if (!isSafeColumnName(key) || SYSTEM_COLUMNS.has(key)) continue;
    typeMap.set(key, field.dataType || 'text');
    if (existing.has(key)) continue;

    const sqlType = sqlTypeForDataType(field.dataType);
    await pool.query(`ALTER TABLE exams ADD COLUMN \`${key}\` ${sqlType}`);
    existing.add(key);
  }

  fieldTypeMapCache = typeMap;
  return { columns: [...existing].filter((c) => !SYSTEM_COLUMNS.has(c)) };
};

const getFieldTypeMap = async (fieldsHint = []) => {
  if (Array.isArray(fieldsHint) && fieldsHint.length) {
    const map = new Map();
    fieldsHint.forEach((f) => {
      if (f?.key) map.set(f.key, f.dataType || 'text');
    });
    fieldTypeMapCache = map;
    return map;
  }
  return fieldTypeMapCache;
};

const EXAM_SELECT_WITH_USERS = `
  SELECT
    e.*,
    cu.first_name AS _created_first_name,
    cu.last_name AS _created_last_name,
    cu.email AS _created_email,
    uu.first_name AS _updated_first_name,
    uu.last_name AS _updated_last_name,
    uu.email AS _updated_email
  FROM exams e
  LEFT JOIN users cu ON cu.id = e.created_by
  LEFT JOIN users uu ON uu.id = e.updated_by
`;

const mapRow = (row, typeMap = fieldTypeMapCache) => {
  if (!row) return null;
  const values = {};

  Object.keys(row).forEach((col) => {
    if (SYSTEM_COLUMNS.has(col)) return;
    if (col.startsWith('_')) return;
    if (col === 'form_values' || col === 'fields_snapshot') return;
    values[col] = decodeCellValue(row[col], typeMap.get(col) || 'text');
  });

  const createdAt = row.created_at ? new Date(row.created_at).getTime() : null;
  const updatedAt = row.updated_at ? new Date(row.updated_at).getTime() : null;
  const createdByLabel = formatUserLabel(
    row._created_first_name,
    row._created_last_name,
    row._created_email,
  );
  const updatedByLabel = formatUserLabel(
    row._updated_first_name,
    row._updated_last_name,
    row._updated_email,
  );

  return {
    id: row.id,
    values,
    fields: [],
    createdBy: row.created_by || null,
    updatedBy: row.updated_by || null,
    createdByLabel,
    updatedByLabel,
    createdByEmail: row._created_email || null,
    updatedByEmail: row._updated_email || null,
    createdAt,
    updatedAt,
  };
};

export const findAll = async (fieldsHint = []) => {
  await ensureExamsTable();
  const typeMap = await getFieldTypeMap(fieldsHint);
  const [rows] = await pool.query(
    `${EXAM_SELECT_WITH_USERS} ORDER BY e.created_at DESC`,
  );
  return rows.map((row) => mapRow(row, typeMap));
};

export const findById = async (id, fieldsHint = []) => {
  await ensureExamsTable();
  const typeMap = await getFieldTypeMap(fieldsHint);
  const [rows] = await pool.query(
    `${EXAM_SELECT_WITH_USERS} WHERE e.id = ? LIMIT 1`,
    [id],
  );
  return mapRow(rows[0], typeMap);
};

const buildWritePayload = (values, fields) => {
  const typeByKey = new Map(
    (Array.isArray(fields) ? fields : []).map((f) => [f.key, f.dataType || 'text']),
  );
  const cols = [];
  const params = [];

  Object.entries(values || {}).forEach(([key, value]) => {
    if (!isSafeColumnName(key) || SYSTEM_COLUMNS.has(key)) return;
    cols.push(key);
    params.push(encodeCellValue(value, typeByKey.get(key) || fieldTypeMapCache.get(key) || 'text'));
  });

  return { cols, params };
};

export const create = async ({ id, values, fields, createdBy }) => {
  await syncFieldColumns(fields);

  const { cols, params } = buildWritePayload(values, fields);
  const allCols = ['id', 'created_by', 'updated_by', ...cols];
  const placeholders = allCols.map(() => '?').join(', ');
  const quoted = allCols
    .map((c) =>
      c === 'id' || c === 'created_by' || c === 'updated_by' ? c : `\`${c}\``,
    )
    .join(', ');

  await pool.query(
    `INSERT INTO exams (${quoted}) VALUES (${placeholders})`,
    [id, createdBy || null, createdBy || null, ...params],
  );

  return findById(id, fields);
};

export const update = async (id, { values, fields, updatedBy }) => {
  const existing = await findById(id, fields);
  if (!existing) return null;

  if (Array.isArray(fields) && fields.length) {
    await syncFieldColumns(fields);
  }

  const nextValues =
    values && typeof values === 'object' ? { ...existing.values, ...values } : existing.values;

  const { cols, params } = buildWritePayload(nextValues, fields || []);
  const auditSets = ['updated_at = CURRENT_TIMESTAMP'];
  const auditParams = [];
  if (updatedBy) {
    auditSets.push('updated_by = ?');
    auditParams.push(updatedBy);
  }

  if (cols.length === 0) {
    await pool.query(
      `UPDATE exams SET ${auditSets.join(', ')} WHERE id = ?`,
      [...auditParams, id],
    );
    return findById(id, fields);
  }

  const sets = [...cols.map((c) => `\`${c}\` = ?`), ...auditSets].join(', ');
  await pool.query(`UPDATE exams SET ${sets} WHERE id = ?`, [
    ...params,
    ...auditParams,
    id,
  ]);

  return findById(id, fields);
};

export const remove = async (id) => {
  await ensureExamsTable();
  const [result] = await pool.query(`DELETE FROM exams WHERE id = ?`, [id]);
  return result.affectedRows > 0;
};

export const upsert = async ({ id, values, fields, createdBy }) => {
  const existing = await findById(id, fields);
  if (existing) {
    return update(id, { values, fields });
  }
  return create({ id, values, fields, createdBy });
};

/**
 * One-time: copy legacy form_values JSON into real columns, then drop JSON columns.
 */
export const migrateLegacyJsonRows = async (fields = []) => {
  await syncFieldColumns(fields);
  const cols = new Set(await listTableColumns());
  if (!cols.has('form_values')) {
    return { migrated: 0 };
  }

  const [rows] = await pool.query(
    `SELECT id, form_values FROM exams WHERE form_values IS NOT NULL`,
  );
  let migrated = 0;
  for (const row of rows) {
    const values = parseJson(row.form_values, {});
    if (!values || typeof values !== 'object') continue;
    await update(row.id, { values, fields });
    migrated += 1;
  }

  await dropLegacyJsonColumns();
  // Reset ensure cache so next call doesn't assume old shape
  ensurePromise = null;
  return { migrated };
};
