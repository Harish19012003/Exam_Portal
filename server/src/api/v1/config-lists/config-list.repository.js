import { getEm } from '../../../database/connection.js';
import { ConfigDropdownList } from '../../../database/entities/index.js';

const mapList = (row) => ({
  id: row._id,
  name: row.name,
  options: Array.isArray(row.options) ? row.options : [],
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const listLists = async () => {
  const em = getEm();
  const rows = await em.find(ConfigDropdownList, {}, { orderBy: { created_at: 'DESC' } });
  return rows.map(mapList);
};

export const findById = async (id) => {
  const row = await getEm().findOne(ConfigDropdownList, { _id: String(id) });
  return row ? mapList(row) : null;
};

export const findByNameKey = async (nameKey) => {
  const row = await getEm().findOne(ConfigDropdownList, { name_key: nameKey });
  return row ? mapList(row) : null;
};

export const insertList = async ({ id, name, nameKey, options, userId }) => {
  const em = getEm();
  const entity = em.create(ConfigDropdownList, {
    _id: id,
    name,
    name_key: nameKey,
    options,
    created_by: userId || null,
    updated_by: userId || null,
  });
  await em.persist(entity).flush();
  return mapList(entity);
};

export const updateList = async (id, { name, nameKey, options, userId }) => {
  const em = getEm();
  const entity = await em.findOne(ConfigDropdownList, { _id: String(id) });
  if (!entity) return null;
  em.assign(entity, { name, name_key: nameKey, options, updated_by: userId || null });
  await em.flush();
  return mapList(entity);
};

export const deleteList = async (id) => {
  const em = getEm();
  const entity = await em.findOne(ConfigDropdownList, { _id: String(id) });
  if (!entity) return null;
  const snapshot = mapList(entity);
  await em.remove(entity).flush();
  return snapshot;
};
