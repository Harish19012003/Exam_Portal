import { getEm } from '../../../database/connection.js';
import { UserGroup } from '../../../database/entities/index.js';

const mapGroup = (row) => ({
  id: String(row.id ?? row._id),
  name: row.name,
  userIds: Array.isArray(row.user_ids) ? row.user_ids.map(String) : [],
  permissions: row.permissions || null,
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

export const create = async ({ name, userIds, permissions, createdBy }) => {
  const em = getEm();
  const entity = em.create(UserGroup, {
    name,
    user_ids: userIds,
    permissions: permissions ?? null,
    created_by: createdBy || null,
  });
  await em.persist(entity).flush();
  return mapGroup(entity);
};

export const update = async (id, { name, userIds, permissions }) => {
  const em = getEm();
  const row = await em.findOne(UserGroup, { id: String(id) });
  if (!row) return null;
  const patch = { name, user_ids: userIds, updated_at: new Date() };
  if (permissions !== undefined) patch.permissions = permissions;
  em.assign(row, patch);
  await em.flush();
  return mapGroup(row);
};

export const remove = async (id) => {
  const em = getEm();
  return em.nativeDelete(UserGroup, { id: String(id) });
};
