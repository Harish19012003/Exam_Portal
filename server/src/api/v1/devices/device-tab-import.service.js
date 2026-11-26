import { getEm } from '../../../database/connection.js';
import { deviceTabEntityByTab } from '../../../database/entities/deviceTabSchemas.js';
import { AppError } from '../../../core/errors.js';
import { ERROR_CODES } from '@exam-view/shared';
import { ObjectId } from '@mikro-orm/mongodb';

const validationError = (message) => new AppError(message, 400, ERROR_CODES.VALIDATION_ERROR);

/**
 * Import flat rows into a Device Master tab collection (not Param / Center-CSR).
 * Uses MikroORM entity registered for that tab.
 */
export const importDeviceTabRows = async (viewKey, rows, examId, { replace = false } = {}) => {
  const key = String(viewKey || '').trim();
  const entity = deviceTabEntityByTab[key]?.row;
  if (!entity) {
    throw validationError(`No data collection is registered for “${key}”.`);
  }
  const scopedExamId = String(examId || '').trim();
  if (!scopedExamId) throw validationError('examId is required');
  if (!Array.isArray(rows) || !rows.length) return { count: 0, removed: 0 };

  const em = getEm();
  let removed = 0;
  if (replace) {
    removed = await em.nativeDelete(entity, { exam_id: scopedExamId });
  }

  const now = new Date();
  await em.insertMany(
    entity,
    rows.map((row) => ({
      ...(row || {}),
      exam_id: scopedExamId,
      version: 1,
      created_at: now,
      updated_at: now,
    })),
  );
  return { count: rows.length, removed: typeof removed === 'number' ? removed : 0 };
};

export const listDeviceTabRows = async (viewKey, examId) => {
  const key = String(viewKey || '').trim();
  const entity = deviceTabEntityByTab[key]?.row;
  if (!entity) return [];
  const scopedExamId = String(examId || '').trim();
  if (!scopedExamId) return [];
  const em = getEm();
  const docs = await em.aggregate(entity, [
    { $match: { exam_id: scopedExamId } },
    { $sort: { created_at: -1 } },
  ]);
  return docs.map((doc) => {
    const { _id, version, created_at, updated_at, values, ...flat } = doc;
    return {
      id: String(_id),
      version: version ?? 1,
      created_at,
      updated_at,
      ...(values && typeof values === 'object' ? values : {}),
      ...flat,
    };
  });
};

export const deleteDeviceTabRows = async (viewKey, ids) => {
  const key = String(viewKey || '').trim();
  const entity = deviceTabEntityByTab[key]?.row;
  if (!entity) return 0;
  const list = (ids || []).map((v) => new ObjectId(String(v)));
  if (!list.length) return 0;
  const em = getEm();
  return em.nativeDelete(entity, { _id: { $in: list } });
};
