import { getEm } from '../../../database/connection.js';
import { UserPreference } from '../../../database/entities/index.js';

const parseValue = (value) => {
  if (value == null) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

export const getUserPreference = async (userId, prefKey) => {
  const em = getEm();
  const row = await em.findOne(UserPreference, { user_id: userId, pref_key: prefKey });
  if (!row) return null;
  return {
    user_id: row.user_id,
    pref_key: row.pref_key,
    pref_value: parseValue(row.pref_value),
    updated_at: row.updated_at,
  };
};

export const upsertUserPreference = async (userId, prefKey, value) => {
  const em = getEm();
  let row = await em.findOne(UserPreference, { user_id: userId, pref_key: prefKey });
  if (row) {
    em.assign(row, { pref_value: value ?? {}, updated_at: new Date() });
  } else {
    row = em.create(UserPreference, {
      user_id: userId,
      pref_key: prefKey,
      pref_value: value ?? {},
    });
    em.persist(row);
  }
  await em.flush();
  return getUserPreference(userId, prefKey);
};

export const deleteUserPreference = async (userId, prefKey) => {
  const em = getEm();
  const row = await em.findOne(UserPreference, { user_id: userId, pref_key: prefKey });
  if (!row) return false;
  await em.remove(row).flush();
  return true;
};
