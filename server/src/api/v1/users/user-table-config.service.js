import { getEm } from '../../../database/connection.js';
import { UserTableMeta } from '../../../database/entities/index.js';
import { AppError } from '../../../core/errors.js';
import { ERROR_CODES } from '@exam-view/shared';

const META_ID = '1';
const MAX_FEATURES_BYTES = 200000;

const findMeta = (em) => em.findOne(UserTableMeta, { _id: META_ID });

export const getTableConfig = async () => {
  const meta = await findMeta(getEm());
  return { features: meta?.features ?? null };
};

export const saveTableConfig = async (body = {}, userId) => {
  const { features } = body;
  if (!features || typeof features !== 'object' || Array.isArray(features)) {
    throw new AppError('features must be an object', 400, ERROR_CODES.VALIDATION_ERROR);
  }
  if (JSON.stringify(features).length > MAX_FEATURES_BYTES) {
    throw new AppError('Features are too large', 400, ERROR_CODES.VALIDATION_ERROR);
  }
  const em = getEm();
  let meta = await findMeta(em);
  if (!meta) {
    meta = em.create(UserTableMeta, { _id: META_ID, features });
    em.persist(meta);
  }
  em.assign(meta, { features, updated_by: userId || null, updated_at: new Date() });
  await em.flush();
  return { features };
};
