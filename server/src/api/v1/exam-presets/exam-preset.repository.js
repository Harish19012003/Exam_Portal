import { getEm } from '../../../database/connection.js';
import { ExamFieldPreset } from '../../../database/entities/index.js';

export const ensurePresetTable = async () => {};

const mapPreset = (row) => {
  const fields = Array.isArray(row.fields) ? row.fields : [];
  return {
    id: String(row.id ?? row._id),
    name: row.name,
    serviceValue: row.service_value,
    fields,
    fieldCount: fields.length,
    features: row.features ?? null,
    updatedAt: row.updated_at,
  };
};

export const listPresets = async () => {
  const em = getEm();
  const rows = await em.find(ExamFieldPreset, {}, { orderBy: { name: 'ASC' } });
  return rows.map(mapPreset);
};

export const findPresetEntity = async (em, id) => {
  if (!id) return null;
  const strId = String(id).trim();
  try {
    const byPk = await em.findOne(ExamFieldPreset, { _id: strId });
    if (byPk) return byPk;
  } catch {
    // If strId is not an ObjectId format
  }
  try {
    const byId = await em.findOne(ExamFieldPreset, { id: strId });
    if (byId) return byId;
  } catch {
    // ignore
  }
  return null;
};

export const findById = async (id) => {
  const em = getEm();
  const row = await findPresetEntity(em, id);
  return row ? mapPreset(row) : null;
};

export const findByService = async (serviceValue) => {
  const em = getEm();
  const row = await em.findOne(ExamFieldPreset, { service_value: serviceValue });
  return row ? mapPreset(row) : null;
};

export const insertPreset = async ({ name, serviceValue, fields, features, createdBy }) => {
  const em = getEm();
  const entity = em.create(ExamFieldPreset, {
    name,
    service_value: serviceValue,
    fields: fields || [],
    features: features || null,
    created_by: createdBy || null,
  });
  await em.persist(entity).flush();
  return String(entity.id ?? entity._id);
};

export const updatePreset = async (id, { name, serviceValue, fields, features }) => {
  const em = getEm();
  const entity = await findPresetEntity(em, id);
  if (!entity) return false;
  em.assign(entity, {
    name,
    service_value: serviceValue,
    fields: fields || [],
    features: features || null,
    updated_at: new Date(),
  });
  await em.flush();
  return true;
};

export const deletePreset = async (id) => {
  const em = getEm();
  const entity = await findPresetEntity(em, id);
  if (!entity) return false;
  await em.remove(entity).flush();
  return true;
};
