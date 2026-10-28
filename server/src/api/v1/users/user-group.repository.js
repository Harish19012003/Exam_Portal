import { getEm } from '../../../database/connection.js';
import { UserGroup } from '../../../database/entities/index.js';

const mapGroup = (row) => ({
  id: String(row.id ?? row._id),
  name: row.name,
  userIds: Array.isArray(row.user_ids) ? row.user_ids.map(String) : [],
  updatedAt: row.updated_at,
});

export const listGroups = async () => {
  const em = getEm();
  const rows = await em.find(UserGroup, {}, { orderBy: { created_at: 'ASC' } });
  return rows.map(mapGroup);
};

export const findById = async (id) => {
  const em = getEm();
  const row = await em.findOne(UserGroup, { id: String(id) });
  return row ? mapGroup(row) : null;
};

export const create = async ({ name, userIds, createdBy }) => {
  const em = getEm();
  const entity = em.create(UserGroup, { name, user_ids: userIds, created_by: createdBy || null });
  await em.persist(entity).flush();
  return mapGroup(entity);
};

export const update = async (id, { name, userIds }) => {
  const em = getEm();
  const row = await em.findOne(UserGroup, { id: String(id) });
  if (!row) return null;
  em.assign(row, { name, user_ids: userIds, updated_at: new Date() });
  await em.flush();
  return mapGroup(row);
};

export const remove = async (id) => {
  const em = getEm();
  return em.nativeDelete(UserGroup, { id: String(id) });
};
