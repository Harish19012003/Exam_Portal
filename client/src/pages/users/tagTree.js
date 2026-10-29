/**
 * Pure helpers for the tag tree. A tree is a list in display order: [{ id, parentId }], where every tag
 * is followed by its sub-tags (the same shape the server returns and saves).
 */

export const depthsOf = (items) => {
  const parentOf = new Map(items.map((i) => [i.id, i.parentId]));
  const depth = new Map();
  items.forEach((i) => {
    let d = 0;
    let cur = i.parentId;
    while (cur && parentOf.has(cur) && d < 20) {
      d += 1;
      cur = parentOf.get(cur);
    }
    depth.set(i.id, d);
  });
  return depth;
};

/** Index just after a tag and all of its sub-tags. */
const blockEnd = (items, depth, index) => {
  let end = index + 1;
  while (end < items.length && depth.get(items[end].id) > depth.get(items[index].id)) end += 1;
  return end;
};

/** Put `id` (with its sub-tags) next to `targetId`, as a sibling of it: above it when moving up, below its block when moving down. */
export const moveNextTo = (items, id, targetId) => {
  const depth = depthsOf(items);
  const from = items.findIndex((i) => i.id === id);
  const to = items.findIndex((i) => i.id === targetId);
  if (from < 0 || to < 0 || from === to) return items;
  const fromEnd = blockEnd(items, depth, from);
  if (to > from && to < fromEnd) return items; // onto its own sub-tag
  const block = items.slice(from, fromEnd).map((i, k) => (k === 0 ? { ...i, parentId: items[to].parentId } : i));
  const rest = [...items.slice(0, from), ...items.slice(fromEnd)];
  const targetAt = rest.findIndex((i) => i.id === targetId);
  const insertAt = to > from ? blockEnd(rest, depthsOf(rest), targetAt) : targetAt;
  return [...rest.slice(0, insertAt), ...block, ...rest.slice(insertAt)];
};

/** Make `id` the last sub-tag of the tag just above it at the same level. Returns the same list when there is none. */
export const indent = (items, id) => {
  const depth = depthsOf(items);
  const at = items.findIndex((i) => i.id === id);
  if (at < 0) return items;
  for (let j = at - 1; j >= 0; j -= 1) {
    if (depth.get(items[j].id) < depth.get(id)) return items;
    if (depth.get(items[j].id) === depth.get(id) && items[j].parentId === items[at].parentId) {
      return items.map((i) => (i.id === id ? { ...i, parentId: items[j].id } : i));
    }
  }
  return items;
};

/** Move `id` up one level, to sit right after its parent. */
export const outdent = (items, id) => {
  const depth = depthsOf(items);
  const from = items.findIndex((i) => i.id === id);
  if (from < 0 || !items[from].parentId) return items;
  const parentAt = items.findIndex((i) => i.id === items[from].parentId);
  const parent = items[parentAt];
  const fromEnd = blockEnd(items, depth, from);
  const block = items.slice(from, fromEnd).map((i, k) => (k === 0 ? { ...i, parentId: parent.parentId } : i));
  const rest = [...items.slice(0, from), ...items.slice(fromEnd)];
  const restDepth = depthsOf(rest);
  const insertAt = blockEnd(rest, restDepth, rest.findIndex((i) => i.id === parent.id));
  return [...rest.slice(0, insertAt), ...block, ...rest.slice(insertAt)];
};

/** Keep the tree, but order the tags at each level the way `sortedIds` lists them. */
export const orderSiblingsBy = (items, sortedIds) => {
  const rank = new Map(sortedIds.map((id, i) => [id, i]));
  const children = new Map();
  items.forEach((i) => {
    const key = i.parentId && items.some((p) => p.id === i.parentId) ? i.parentId : null;
    if (!children.has(key)) children.set(key, []);
    children.get(key).push(i);
  });
  const out = [];
  const walk = (key) =>
    (children.get(key) || []).sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0)).forEach((i) => {
      out.push({ id: i.id, parentId: key });
      walk(i.id);
    });
  walk(null);
  return out;
};
