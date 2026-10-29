import { AppError } from '../../../core/errors.js';
import { ERROR_CODES } from '@exam-view/shared';
import { getEm } from '../../../database/connection.js';
import { User, UserTag } from '../../../database/entities/index.js';

const MAX_TAGS = 100;
const MAX_TAGS_PER_USER = 30;
/** Levels of nesting allowed (a top-level tag is level 1). */
const MAX_LEVELS = 5;
const MAX_USERS_PER_CALL = 5000;
const PALETTE = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#14b8a6', '#f97316', '#64748b'];

const validationError = (message) => new AppError(message, 400, ERROR_CODES.VALIDATION_ERROR);
const notFound = () => new AppError('Tag not found', 404, ERROR_CODES.NOT_FOUND);

const idOf = (row) => String(row.id ?? row._id);

const mapTag = (row, count = 0, depth = 0) => ({
  id: idOf(row),
  name: row.name,
  color: row.color,
  parentId: row.parent_id || null,
  depth,
  userCount: count,
  createdAt: row.created_at,
});

/** The admin's order first; tags never ordered keep A-Z. */
const byOrder = (a, b) => (a.sort_order || 0) - (b.sort_order || 0) || a.name.localeCompare(b.name);

/** Tags in tree order (parent, then its children), each with its depth. A tag whose parent is missing counts as top level. */
const treeOrder = (rows) => {
  const known = new Set(rows.map(idOf));
  const children = new Map();
  rows.forEach((row) => {
    const parent = row.parent_id && known.has(String(row.parent_id)) ? String(row.parent_id) : null;
    if (!children.has(parent)) children.set(parent, []);
    children.get(parent).push(row);
  });
  const out = [];
  const walk = (parent, depth, seen) => {
    (children.get(parent) || []).sort(byOrder).forEach((row) => {
      const id = idOf(row);
      if (seen.has(id)) return;
      out.push({ row, depth });
      walk(id, depth + 1, new Set(seen).add(id));
    });
  };
  walk(null, 0, new Set());
  return out;
};

/** Throws if the parent links form a loop or nest deeper than MAX_LEVELS. `parentOf` maps id -> parent id | null. */
const assertTreeValid = (parentOf) => {
  for (const id of parentOf.keys()) {
    const seen = new Set([id]);
    let level = 1;
    let cur = parentOf.get(id);
    while (cur) {
      if (seen.has(cur)) throw validationError('A tag cannot be placed under itself or one of its own sub-tags');
      seen.add(cur);
      level += 1;
      if (level > MAX_LEVELS) throw validationError(`Tags can be nested at most ${MAX_LEVELS} levels deep`);
      cur = parentOf.get(cur) ?? null;
    }
  }
};

const parentMapOf = (rows) => new Map(rows.map((r) => [idOf(r), r.parent_id ? String(r.parent_id) : null]));

const cleanParent = (value, rows) => {
  if (value === null || value === undefined || value === '') return null;
  const id = String(value);
  if (!rows.some((r) => idOf(r) === id)) throw validationError('The parent tag no longer exists');
  return id;
};

const ids = (value, limit) => {
  const list = [...new Set((Array.isArray(value) ? value : []).map((v) => String(v ?? '').trim()).filter(Boolean))];
  if (list.length > limit) throw validationError('Too many items in one request');
  return list;
};

const cleanName = (value) => {
  const name = String(value ?? '').trim().replace(/\s+/g, ' ');
  if (!name || name.length > 30) throw validationError('Tag name is required (max 30 characters)');
  return name;
};

const cleanColor = (value, fallback) => (/^#[0-9a-f]{6}$/i.test(String(value ?? '')) ? String(value).toLowerCase() : fallback);

const usersByTag = async (em) => {
  const users = await em.find(User, {}, { fields: ['_id', 'tag_ids'] });
  const counts = new Map();
  users.forEach((u) => (Array.isArray(u.tag_ids) ? u.tag_ids : []).forEach((id) => counts.set(String(id), (counts.get(String(id)) || 0) + 1)));
  return counts;
};

export const listTags = async () => {
  const em = getEm();
  const [rows, counts] = await Promise.all([em.find(UserTag, {}), usersByTag(em)]);
  return treeOrder(rows).map(({ row, depth }) => mapTag(row, counts.get(idOf(row)) || 0, depth));
};

const assertNameFree = async (em, name, ignoreId) => {
  const rows = await em.find(UserTag, {});
  const clash = rows.find((r) => r.name.toLowerCase() === name.toLowerCase() && String(r.id ?? r._id) !== String(ignoreId ?? ''));
  if (clash) throw new AppError('A tag with this name already exists', 409, ERROR_CODES.CONFLICT);
  return rows.length;
};

export const createTag = async (body = {}, actor) => {
  const em = getEm();
  const name = cleanName(body.name);
  const total = await assertNameFree(em, name);
  if (total >= MAX_TAGS) throw validationError(`At most ${MAX_TAGS} tags`);
  const existing = await em.find(UserTag, {});
  const last = Math.max(0, ...existing.map((t) => t.sort_order || 0));
  const parentId = cleanParent(body.parentId, existing);
  const tag = em.create(UserTag, {
    name,
    parent_id: parentId,
    color: cleanColor(body.color, PALETTE[total % PALETTE.length]),
    sort_order: last + 1,
    created_by: actor?.id || null,
  });
  const nextParents = parentMapOf(existing);
  nextParents.set(idOf(tag), parentId);
  assertTreeValid(nextParents);
  await em.persist(tag).flush();
  return mapTag(tag);
};

export const updateTag = async (id, body = {}) => {
  const em = getEm();
  const tag = await em.findOne(UserTag, { id: String(id) });
  if (!tag) throw notFound();
  const name = body.name !== undefined ? cleanName(body.name) : tag.name;
  await assertNameFree(em, name, id);
  const patch = { name, color: cleanColor(body.color, tag.color), updated_at: new Date() };
  if (body.parentId !== undefined) {
    const all = await em.find(UserTag, {});
    patch.parent_id = cleanParent(body.parentId, all);
    const parents = parentMapOf(all);
    parents.set(idOf(tag), patch.parent_id);
    assertTreeValid(parents);
  }
  em.assign(tag, patch);
  await em.flush();
  return mapTag(tag);
};

/**
 * Save the whole tag tree in one go. `items` is the list in display order: [{ id, parentId }].
 * Tags not named keep their parent and sort after the named ones. (`ids` alone only reorders.)
 */
export const reorderTags = async (body = {}) => {
  const em = getEm();
  const rows = await em.find(UserTag, {});
  const byId = new Map(rows.map((t) => [idOf(t), t]));
  const current = treeOrder(rows).map(({ row }) => idOf(row));

  const items = Array.isArray(body.items)
    ? body.items.map((i) => ({ id: String(i?.id ?? ''), parentId: i?.parentId ? String(i.parentId) : null }))
    : ids(body.ids, MAX_TAGS).map((id) => ({ id, parentId: byId.get(id)?.parent_id || null }));
  const named = [];
  const seen = new Set();
  items.forEach((i) => {
    if (byId.has(i.id) && !seen.has(i.id)) {
      seen.add(i.id);
      named.push(i);
    }
  });
  if (!named.length) throw validationError('Choose the tags to put in order');
  if (named.some((i) => i.parentId && !byId.has(i.parentId))) throw validationError('The parent tag no longer exists');

  const parents = parentMapOf(rows);
  named.forEach((i) => parents.set(i.id, i.parentId));
  assertTreeValid(parents);

  const rest = current.filter((id) => !seen.has(id));
  [...named.map((i) => i.id), ...rest].forEach((id, index) => {
    const tag = byId.get(id);
    tag.sort_order = index + 1;
    tag.parent_id = parents.get(id) || null;
  });
  await em.flush();
  return listTags();
};

/** Deleting a tag also takes it off every user that has it. */
export const deleteTag = async (id) => {
  const em = getEm();
  const tag = await em.findOne(UserTag, { id: String(id) });
  if (!tag) throw notFound();
  const tagId = String(tag.id ?? tag._id);
  // Sub-tags move up one level instead of being deleted with it.
  const everyTag = await em.find(UserTag, {});
  everyTag.forEach((t) => {
    if (String(t.parent_id || '') === tagId) t.parent_id = tag.parent_id || null;
  });
  const users = await em.find(User, {});
  users.forEach((u) => {
    if (Array.isArray(u.tag_ids) && u.tag_ids.map(String).includes(tagId)) {
      u.tag_ids = u.tag_ids.map(String).filter((t) => t !== tagId);
    }
  });
  em.remove(tag);
  await em.flush();
  return { success: true };
};

const assertTagsExist = async (em, tagIds) => {
  if (!tagIds.length) return;
  const known = new Set((await em.find(UserTag, {})).map((t) => String(t.id ?? t._id)));
  const missing = tagIds.find((t) => !known.has(t));
  if (missing) throw validationError('One of the tags no longer exists. Reload and try again.');
};

/** Replace the tags of one user. */
export const setUserTags = async (userId, body = {}) => {
  const em = getEm();
  const tagIds = ids(body.tagIds, MAX_TAGS_PER_USER);
  await assertTagsExist(em, tagIds);
  const user = await em.findOne(User, { _id: String(userId) });
  if (!user) throw new AppError('User not found', 404, ERROR_CODES.NOT_FOUND);
  user.tag_ids = tagIds;
  await em.flush();
  return { id: String(user._id), tag_ids: tagIds };
};

/** Add and/or remove tags for several users at once. */
export const assignTags = async (body = {}) => {
  const em = getEm();
  const userIds = ids(body.userIds, MAX_USERS_PER_CALL);
  const add = ids(body.add, MAX_TAGS_PER_USER);
  const remove = new Set(ids(body.remove, MAX_TAGS));
  if (!userIds.length) throw validationError('Choose at least one user');
  if (!add.length && !remove.size) throw validationError('Choose tags to add or remove');
  await assertTagsExist(em, add);

  const users = await em.find(User, { _id: { $in: userIds } });
  users.forEach((u) => {
    const next = new Set((Array.isArray(u.tag_ids) ? u.tag_ids : []).map(String).filter((t) => !remove.has(t)));
    add.forEach((t) => next.add(t));
    if (next.size > MAX_TAGS_PER_USER) throw validationError(`A user can have at most ${MAX_TAGS_PER_USER} tags`);
    u.tag_ids = [...next];
  });
  await em.flush();
  return { success: true, updated: users.length };
};
