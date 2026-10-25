import { pool } from '../../../database/connection.js';

export const getUserPreference = async (userId, prefKey) => {
  const [rows] = await pool.query(
    `SELECT user_id, pref_key, pref_value, updated_at
     FROM user_preferences
     WHERE user_id = ? AND pref_key = ?
     LIMIT 1`,
    [userId, prefKey],
  );
  return rows[0] || null;
};

export const upsertUserPreference = async (userId, prefKey, value) => {
  const json = JSON.stringify(value ?? {});
  await pool.query(
    `INSERT INTO user_preferences (user_id, pref_key, pref_value)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE
       pref_value = VALUES(pref_value),
       updated_at = NOW()`,
    [userId, prefKey, json],
  );
  return getUserPreference(userId, prefKey);
};

export const deleteUserPreference = async (userId, prefKey) => {
  const [result] = await pool.query(
    'DELETE FROM user_preferences WHERE user_id = ? AND pref_key = ?',
    [userId, prefKey],
  );
  return result?.affectedRows > 0;
};
