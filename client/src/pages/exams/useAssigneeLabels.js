import { useEffect, useMemo, useState } from 'react';
import {
  getAssigneeLabel,
  seedAssigneeLabels,
  subscribeAssigneeLabels,
} from '../../components/DynamicTable/editors/assigneeLabels';
import { resolveAssignableUsers } from './assigneeApi';
import { isUserTagsField } from './tableLookupApi';

const idsOf = (value) => (Array.isArray(value) ? value : value ? [value] : []).map(String).filter(Boolean);

const looksLikeUserId = (value) => {
  const s = String(value || '').trim();
  if (!s) return false;
  if (/^[a-f0-9]{24}$/i.test(s)) return true;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) return true;
  return false;
};

/**
 * Replace stored user ids on userTags fields with display names for the table.
 * Raw ids stay on `rawValues`.
 */
export const useAssigneeDisplayRows = (rows, fields) => {
  const assigneeFields = useMemo(() => (fields || []).filter(isUserTagsField), [fields]);
  const [labels, setLabels] = useState({}); // id -> name
  const [seedTick, setSeedTick] = useState(0);

  useEffect(() => subscribeAssigneeLabels(() => setSeedTick((n) => n + 1)), []);

  const wantedIds = useMemo(() => {
    const set = new Set();
    assigneeFields.forEach((f) => {
      rows.forEach((r) => {
        const raw = r.rawValues?.[f.key] ?? r.values?.[f.key];
        idsOf(raw).forEach((id) => {
          if (looksLikeUserId(id)) set.add(id);
        });
      });
    });
    return [...set].sort();
  }, [rows, assigneeFields]);
  const wantedSig = wantedIds.join(',');

  useEffect(() => {
    if (wantedIds.length === 0) return undefined;
    let cancelled = false;
    resolveAssignableUsers(wantedIds)
      .then((map) => {
        if (cancelled) return;
        const next = {};
        Object.entries(map || {}).forEach(([id, u]) => {
          next[id] = u?.name || u?.email || id;
        });
        seedAssigneeLabels(next);
        setLabels((prev) => ({ ...prev, ...next }));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantedSig]);

  return useMemo(() => {
    if (assigneeFields.length === 0) return rows;
    return rows.map((row) => {
      const values = { ...row.values };
      const rawBase = row.rawValues || row.values;
      assigneeFields.forEach((f) => {
        const candidate = rawBase?.[f.key] ?? row.values?.[f.key];
        // Prefer real ids from rawValues; if the cell still holds ids in values, use those.
        const raw = idsOf(candidate).some(looksLikeUserId)
          ? candidate
          : idsOf(row.values?.[f.key]).some(looksLikeUserId)
            ? row.values[f.key]
            : candidate;
        const ids = idsOf(raw);
        if (ids.length === 0) {
          values[f.key] = Array.isArray(raw) ? [] : '';
          return;
        }
        // Already display names (optimistic) — keep.
        if (!ids.every(looksLikeUserId)) {
          values[f.key] = Array.isArray(raw) ? ids : ids[0];
          return;
        }
        const text = ids.map((id) => getAssigneeLabel(id) || labels[id] || '…');
        values[f.key] = ids.length > 1 || Array.isArray(raw) ? text : text[0];
      });
      return { ...row, values, rawValues: rawBase };
    });
    // seedTick re-reads getAssigneeLabel after picker / resolve
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, assigneeFields, labels, seedTick]);
};

/** Put user ids back when the table cell still holds display names. */
export const restoreAssigneeIds = (updatedValues, originalValues, fields, rowId) => {
  const next = { ...updatedValues };
  (fields || []).filter(isUserTagsField).forEach((f) => {
    if (!(f.key in next)) return;
    const cur = next[f.key];
    const ids = idsOf(cur);
    // Still looks like ids — keep.
    if (ids.length && ids.every(looksLikeUserId)) return;
    // Names or empty: keep original saved ids if the patch didn't come from the assignee editor.
    // (Assignee editor always writes id[].)
    if (originalValues && f.key in originalValues) next[f.key] = originalValues[f.key];
  });
  return next;
};
