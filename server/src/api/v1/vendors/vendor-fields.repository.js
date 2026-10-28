import { getEm } from '../../../database/connection.js';
import { VendorMeta } from '../../../database/entities/index.js';

export const VENDOR_TABLE = 'vendors';
export const VENDOR_RESERVED_KEYS = ['id', 'version', 'created_at', 'updated_at', 'values', '_id'];

const META_ID = '1';

export const isMissingMetaTable = () => false;

const ensureMeta = async (em) => {
  let meta = await em.findOne(VendorMeta, { _id: META_ID });
  if (!meta) {
    meta = em.create(VendorMeta, { _id: META_ID, fields: [], features: null });
    em.persist(meta);
    await em.flush();
  }
  return meta;
};

export const listFields = async () => {
  const em = getEm();
  const meta = await ensureMeta(em);
  const fields = Array.isArray(meta.fields) ? meta.fields : [];
  return fields.map((def, i) => ({
    ...def,
    key: def.key,
    label: def.label,
    dataType: def.dataType || 'text',
    order: def.order ?? i + 1,
  }));
};

export const getFeatures = async () => {
  const em = getEm();
  const meta = await ensureMeta(em);
  return meta.features ?? null;
};

export const saveFeatures = async (features, userId) => {
  const em = getEm();
  const meta = await ensureMeta(em);
  em.assign(meta, {
    features,
    updated_by: userId || null,
    updated_at: new Date(),
  });
  await em.flush();
};

/** Persist field definitions only (no DDL). */
export const applyFields = async (fields) => {
  const em = getEm();
  const meta = await ensureMeta(em);
  const normalized = (fields || []).map((def, i) => ({
    ...def,
    key: def.key,
    label: def.label,
    dataType: def.dataType,
    order: i + 1,
  }));
  em.assign(meta, { fields: normalized, updated_at: new Date() });
  await em.flush();
};
