import { useEffect, useMemo, useState } from 'react';
import { takeLookupPick } from '../../components/DynamicTable/editors/lookupPicks';
import {
  MISSING_LABEL,
  groupSyncPatch,
  isLinkedField,
  isTableSourceField,
  linkedFieldsOf,
  lookupText,
  resolveLookupRows,
} from './tableLookupApi';

const idsOf = (value) => (Array.isArray(value) ? value : value ? [value] : []).map(String);

/**
 * Table rows for display. A field that reads from another table holds a row id, so show that
 * row's current label; a Linked value field shows a column of the same row. The saved ids stay on
 * `rawValues` (used by duplicate / update).
 */
export const useLookupDisplayRows = (rows, fields) => {
  const sourceFields = useMemo(() => (fields || []).filter(isTableSourceField), [fields]);
  const [resolved, setResolved] = useState({}); // { sourceKey: { id: { text, values } | null } }

  const wanted = useMemo(() => {
    const out = {};
    sourceFields.forEach((f) => {
      const set = new Set();
      rows.forEach((r) => idsOf(r.values?.[f.key]).forEach((id) => set.add(id)));
      out[f.key] = {
        ids: [...set].sort(),
        columns: [...new Set(linkedFieldsOf(fields, f.key).map((l) => l.linkedFrom.column))].sort(),
      };
    });
    return out;
  }, [rows, sourceFields, fields]);
  const wantedSig = JSON.stringify(wanted);

  useEffect(() => {
    let cancelled = false;
    sourceFields.forEach((f) => {
      const { ids, columns } = wanted[f.key] || { ids: [], columns: [] };
      if (ids.length === 0) return;
      resolveLookupRows({ ...f.tableSource, columns, ids: ids.slice(0, 500) })
        .then((found) => {
          if (cancelled) return;
          const next = {};
          ids.forEach((id) => {
            next[id] = found?.[id] ? { text: lookupText(found[id]), values: found[id].values || {} } : null;
          });
          setResolved((prev) => ({ ...prev, [f.key]: { ...(prev[f.key] || {}), ...next } }));
        })
        .catch(() => {});
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantedSig]);

  return useMemo(() => {
    const linked = (fields || []).filter(isLinkedField);
    if (sourceFields.length === 0 && linked.length === 0) return rows;
    return rows.map((row) => {
      const values = { ...row.values };
      sourceFields.forEach((f) => {
        const raw = row.values?.[f.key];
        const ids = idsOf(raw);
        if (ids.length === 0) return;
        const text = ids.map((id) => {
          const hit = resolved[f.key]?.[id];
          return hit === undefined ? '…' : hit ? hit.text : MISSING_LABEL;
        });
        values[f.key] = Array.isArray(raw) ? text : text[0];
      });
      linked.forEach((l) => {
        const [id] = idsOf(row.values?.[l.linkedFrom.fieldKey]);
        if (!id) {
          values[l.key] = '';
          return;
        }
        const hit = resolved[l.linkedFrom.fieldKey]?.[id];
        values[l.key] = hit === undefined ? '…' : hit ? hit.values[l.linkedFrom.column] ?? '' : MISSING_LABEL;
      });
      return { ...row, values, rawValues: row.values };
    });
  }, [rows, sourceFields, fields, resolved]);
};

/**
 * `updatedValues` from an inline edit carry display labels. Put the saved ids back: a lookup cell the
 * user just picked takes its new row id (and the other members of its column group follow); every
 * other lookup or linked cell keeps what was saved.
 */
export const restoreLookupIds = (updatedValues, originalValues, fields, rowId) => {
  const next = { ...updatedValues };
  const keep = (key) => {
    if (originalValues && key in originalValues) next[key] = originalValues[key];
    else delete next[key];
  };
  (fields || []).filter(isLinkedField).forEach((f) => keep(f.key));
  const picked = [];
  (fields || []).filter(isTableSourceField).forEach((f) => {
    const id = rowId ? takeLookupPick(String(rowId), f.key) : undefined;
    if (id === undefined) keep(f.key);
    else picked.push([f.key, id]);
  });
  picked.forEach(([key, id]) => {
    next[key] = id;
    Object.assign(next, groupSyncPatch(fields, key, id));
  });
  return next;
};
