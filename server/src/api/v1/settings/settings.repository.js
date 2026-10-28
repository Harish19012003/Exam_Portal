import { getEm } from '../../../database/connection.js';
import { SystemSetting } from '../../../database/entities/index.js';

const parseValue = (value) => {
  if (value == null) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

export const getSetting = async (key) => {
  const em = getEm();
  const row = await em.findOne(SystemSetting, { setting_key: key });
  if (!row) return null;
  return {
    setting_key: row.setting_key,
    setting_value: parseValue(row.setting_value),
    description: row.description,
    updated_at: row.updated_at,
    updated_by: row.updated_by,
  };
};

export const upsertSetting = async (key, value, description, updatedBy) => {
  const em = getEm();
  let row = await em.findOne(SystemSetting, { setting_key: key });
  if (row) {
    em.assign(row, {
      setting_value: value ?? {},
      description: description || row.description || null,
      updated_by: updatedBy || null,
      updated_at: new Date(),
    });
  } else {
    row = em.create(SystemSetting, {
      _id: key,
      setting_key: key,
      setting_value: value ?? {},
      description: description || null,
      updated_by: updatedBy || null,
    });
    em.persist(row);
  }
  await em.flush();
  return getSetting(key);
};

export const deleteSetting = async (key) => {
  const em = getEm();
  const row = await em.findOne(SystemSetting, { setting_key: key });
  if (!row) return false;
  await em.remove(row).flush();
  return true;
};
