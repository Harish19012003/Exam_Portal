import { getEm } from '../../../database/connection.js';
import { CenterCsrMatchingMeta } from '../../../database/entities/index.js';
import { CENTER_CSR_FIXED_KEYS, stripFixedFields, withHardcodedFixedFields } from './fixedFields.js';

export const CENTER_CSR_TABLE = 'center_csr_matching';
export const CENTER_CSR_RESERVED_KEYS = [
  'id',
  'version',
  'created_at',
  'updated_at',
  'values',
  '_id',
  ...CENTER_CSR_FIXED_KEYS,
];

const META_ID = '1';

const ensureMeta = async (em) => {
  let meta = await em.findOne(CenterCsrMatchingMeta, { _id: META_ID });
  if (!meta) {
    meta = em.create(CenterCsrMatchingMeta, { _id: META_ID, fields: [], features: null });
    em.persist(meta);
    await em.flush();
  }
  return meta;
};

/**
 * Full field list: hardcoded fixed columns + extras from meta.
 * Cleans meta if it still stores copies of the fixed columns.
 */
export const listFields = async () => {
  const em = getEm();
  const meta = await ensureMeta(em);
  const raw = Array.isArray(meta.fields) ? meta.fields : [];
  const extras = stripFixedFields(raw);
  if (extras.length !== raw.length) {
    em.assign(meta, { fields: extras, updated_at: new Date() });
    await em.flush();
  }
  return withHardcodedFixedFields(extras).map((def, i) => ({
    ...def,
    key: def.key,
    label: def.label,
    dataType: def.dataType || 'text',
    order: def.order ?? i + 1,
  }));
};

/** Extra (non-hardcoded) fields only — what is stored in meta. */
export const listExtraFields = async () => {
  const em = getEm();
  const meta = await ensureMeta(em);
  return stripFixedFields(Array.isArray(meta.fields) ? meta.fields : []);
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

/** Persist extra field definitions only (fixed columns stay hardcoded). */
export const applyFields = async (fields) => {
  const em = getEm();
  const meta = await ensureMeta(em);
  const extras = stripFixedFields(fields).map((def, i) => ({
    ...def,
    key: def.key,
    label: def.label,
    dataType: def.dataType,
    order: i + 1,
  }));
  em.assign(meta, { fields: extras, updated_at: new Date() });
  await em.flush();
};
