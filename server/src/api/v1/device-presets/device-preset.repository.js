import { DEFAULT_DEVICE_MASTER_VIEW } from '@exam-view/shared';
import { getEm } from '../../../database/connection.js';
import { DeviceFieldPreset } from '../../../database/entities/index.js';

const normalizeView = (view) =>
  String(view || DEFAULT_DEVICE_MASTER_VIEW).trim() || DEFAULT_DEVICE_MASTER_VIEW;

const mapPreset = (row) => {
  const fields = Array.isArray(row.fields) ? row.fields : [];
  return {
    id: String(row.id ?? row._id),
    name: row.name,
    view: normalizeView(row.view),
    fields,
    fieldCount: fields.length,
    features: row.features ?? null,
    layout: row.layout ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

export const listPresets = async () => {
  const em = getEm();
  const rows = await em.find(DeviceFieldPreset, {}, { orderBy: { name: 'ASC' } });
  return rows.map(mapPreset);
};

export const findPresetEntity = async (em, id) => {
  if (!id) return null;
  const strId = String(id).trim();
  try {
    const byPk = await em.findOne(DeviceFieldPreset, { _id: strId });
    if (byPk) return byPk;
  } catch {
    // not an ObjectId
  }
  try {
    const byId = await em.findOne(DeviceFieldPreset, { id: strId });
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

export const findByViewAndName = async (view, name) => {
  const em = getEm();
  const viewKey = normalizeView(view);
  const wanted = String(name || '').trim();
  if (!wanted) return null;
  const row = await em.findOne(DeviceFieldPreset, { view: viewKey, name: wanted });
  return row ? mapPreset(row) : null;
};

/** Latest device preset for a Device Master tab (fields only — used for API column mapping). */
export const findLatestFieldsByView = async (view) => {
  const em = getEm();
  const viewKey = normalizeView(view);
  const row = await em.findOne(
    DeviceFieldPreset,
    { view: viewKey },
    { orderBy: { updated_at: 'DESC', created_at: 'DESC' } },
  );
  if (!row) return [];
  return Array.isArray(row.fields) ? row.fields : [];
};

export const insertPreset = async ({ name, view, fields, features, layout, createdBy }) => {
  const em = getEm();
  const entity = em.create(DeviceFieldPreset, {
    name,
    view: normalizeView(view),
    fields: fields || [],
    features: features || null,
    layout: layout || null,
    created_by: createdBy || null,
  });
  await em.persist(entity).flush();
  return String(entity.id ?? entity._id);
};

export const updatePreset = async (id, { name, view, fields, features, layout }) => {
  const em = getEm();
  const entity = await findPresetEntity(em, id);
  if (!entity) return false;
  em.assign(entity, {
    name,
    view: normalizeView(view),
    fields: fields || [],
    features: features || null,
    ...(layout !== undefined ? { layout: layout || null } : {}),
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
