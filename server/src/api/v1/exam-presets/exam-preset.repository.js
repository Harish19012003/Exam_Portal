import { DEFAULT_EXAM_VIEW } from '@exam-view/shared';
import { getEm, getOrm } from '../../../database/connection.js';
import { ExamFieldPreset } from '../../../database/entities/index.js';

let ensured = false;

/**
 * Backfill legacy presets (no view → center-list) and swap the old unique(service)
 * index for unique(service, view). Safe to call repeatedly.
 */
export const ensurePresetTable = async () => {
  if (ensured) return;
  try {
    const db = getOrm().em.getConnection().getDb();
    const col = db.collection('exam_field_presets');
    await col.updateMany(
      { $or: [{ view: { $exists: false } }, { view: null }, { view: '' }] },
      { $set: { view: DEFAULT_EXAM_VIEW } },
    );
    const indexes = await col.indexes().catch(() => []);
    for (const idx of indexes) {
      if (idx.name === '_id_') continue;
      const keys = Object.keys(idx.key || {});
      // Drop the old single-field unique on service_value.
      if (keys.length === 1 && keys[0] === 'service_value' && idx.unique) {
        await col.dropIndex(idx.name).catch(() => {});
      }
    }
    await col
      .createIndex({ service_value: 1, view: 1 }, { unique: true, name: 'service_value_view_unique' })
      .catch(() => {});
  } catch {
    // Index work is best-effort; app still runs with in-code duplicate checks.
  }
  ensured = true;
};

const normalizeView = (view) => String(view || DEFAULT_EXAM_VIEW).trim() || DEFAULT_EXAM_VIEW;

const mapPreset = (row) => {
  const fields = Array.isArray(row.fields) ? row.fields : [];
  return {
    id: String(row.id ?? row._id),
    name: row.name,
    serviceValue: row.service_value,
    view: normalizeView(row.view),
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

/** Exact service + tab match (legacy rows without view count as center-list). */
export const findByServiceAndView = async (serviceValue, view = DEFAULT_EXAM_VIEW) => {
  const em = getEm();
  const viewKey = normalizeView(view);
  const wanted = String(serviceValue || '').trim();
  if (!wanted) return null;

  if (viewKey === DEFAULT_EXAM_VIEW) {
    const row = await em.findOne(ExamFieldPreset, {
      service_value: wanted,
      $or: [{ view: viewKey }, { view: null }, { view: { $exists: false } }],
    });
    if (row) return mapPreset(row);
  }

  const row = await em.findOne(ExamFieldPreset, { service_value: wanted, view: viewKey });
  return row ? mapPreset(row) : null;
};

/** @deprecated use findByServiceAndView — kept for any leftover callers */
export const findByService = async (serviceValue) => findByServiceAndView(serviceValue, DEFAULT_EXAM_VIEW);

export const insertPreset = async ({ name, serviceValue, view, fields, features, createdBy }) => {
  const em = getEm();
  const entity = em.create(ExamFieldPreset, {
    name,
    service_value: serviceValue,
    view: normalizeView(view),
    fields: fields || [],
    features: features || null,
    created_by: createdBy || null,
  });
  await em.persist(entity).flush();
  return String(entity.id ?? entity._id);
};

export const updatePreset = async (id, { name, serviceValue, view, fields, features }) => {
  const em = getEm();
  const entity = await findPresetEntity(em, id);
  if (!entity) return false;
  em.assign(entity, {
    name,
    service_value: serviceValue,
    view: normalizeView(view),
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
