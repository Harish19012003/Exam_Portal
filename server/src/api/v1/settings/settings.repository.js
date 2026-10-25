import { pool } from '../../../database/connection.js';

export const getSetting = async (key) => {
  const [rows] = await pool.query(
    'SELECT setting_key, setting_value, description, updated_at, updated_by FROM system_settings WHERE setting_key = ? LIMIT 1',
    [key],
  );
  return rows[0] || null;
};

export const upsertSetting = async (key, value, description, updatedBy) => {
  const json = JSON.stringify(value ?? {});
  await pool.query(
    `INSERT INTO system_settings (setting_key, setting_value, description, updated_by)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       setting_value = VALUES(setting_value),
       description = VALUES(description),
       updated_by = VALUES(updated_by),
       updated_at = NOW()`,
    [key, json, description || null, updatedBy || null],
  );
  return getSetting(key);
};
