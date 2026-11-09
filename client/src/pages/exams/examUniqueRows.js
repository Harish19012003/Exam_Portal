/**
 * Composite uniqueness for imported / shared columns (e.g. State + City + Vendor Name).
 * Stored on view/preset features as `uniqueRowKeys: string[]`.
 */

export const normalizeUniqueRowKeys = (keys) =>
  Array.from(
    new Set(
      (Array.isArray(keys) ? keys : [])
        .map((k) => String(k || '').trim())
        .filter(Boolean),
    ),
  );

/** Build a stable composite identity from row values (case-insensitive, trimmed). */
export const uniqueRowComposite = (values, keys) => {
  const keyList = normalizeUniqueRowKeys(keys);
  if (!keyList.length) return '';
  const bag = values && typeof values === 'object' ? values : {};
  return keyList.map((k) => String(bag[k] ?? '').trim().toLowerCase()).join('\0');
};

/**
 * Keep the first row for each composite key combination.
 * Empty key lists return the input unchanged.
 */
export const dedupeRowsByUniqueKeys = (rows = [], keys = []) => {
  const keyList = normalizeUniqueRowKeys(keys);
  if (!keyList.length || !Array.isArray(rows) || rows.length === 0) return rows;
  const seen = new Set();
  const out = [];
  for (const row of rows) {
    const values = row?.values && typeof row.values === 'object' ? row.values : row;
    const composite = uniqueRowComposite(values, keyList);
    if (seen.has(composite)) continue;
    seen.add(composite);
    out.push(row);
  }
  return out;
};

export const uniqueRowKeysLabel = (fields = [], keys = []) => {
  const keyList = normalizeUniqueRowKeys(keys);
  if (!keyList.length) return '';
  const byKey = new Map((fields || []).map((f) => [f.key, f.label || f.key]));
  return keyList.map((k) => byKey.get(k) || k).join(' · ');
};
