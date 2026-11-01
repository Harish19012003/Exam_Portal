import { useEffect, useMemo, useState } from 'react';
import {
  getLookupDisplayOverride,
  subscribeLookupDisplayOverrides,
} from '../../components/DynamicTable/editors/lookupDisplayOverrides';
import { peekLookupPick } from '../../components/DynamicTable/editors/lookupPicks';
import { getLookupSeed, subscribeLookupSeeds } from '../../components/DynamicTable/editors/lookupSeeds';
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

const textFromSeed = (seed, column, detailColumn) => {
  if (!seed || !column) return null;
  const label = seed[column];
  if (label === undefined || label === null) return null;
  const detail = detailColumn ? seed[detailColumn] : '';
  return detail ? `${label} · ${detail}` : String(label);
};

/** Mongo ObjectId / UUID-ish — anything else is treated as an already-resolved label. */
const isLikelyLookupId = (value) => {
  const s = String(value || '').trim();
  if (!s) return false;
  if (/^[a-f0-9]{24}$/i.test(s)) return true;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) return true;
  return false;
};

/**
 * Table rows for display. A field that reads from another table holds a row id, so show that
 * row's current label; a Linked value field shows a column of the same row. The saved ids stay on
 * `rawValues` (used by duplicate / update).
 */
export const useLookupDisplayRows = (rows, fields) => {
  const sourceFields = useMemo(() => (fields || []).filter(isTableSourceField), [fields]);
  const [resolved, setResolved] = useState({}); // { sourceKey: { id: { text, values } | null } }
  const [seedTick, setSeedTick] = useState(0);
  const [overrideTick, setOverrideTick] = useState(0);

  useEffect(() => subscribeLookupSeeds(() => setSeedTick((n) => n + 1)), []);
  useEffect(() => subscribeLookupDisplayOverrides(() => setOverrideTick((n) => n + 1)), []);

  const wanted = useMemo(() => {
    const out = {};
    sourceFields.forEach((f) => {
      const set = new Set();
      rows.forEach((r) => {
        const raw = r.values?.[f.key];
        // Skip optimistic display labels — only resolve real stored ids.
        if (raw && !Array.isArray(raw) && !isLikelyLookupId(raw)) return;
        idsOf(raw).forEach((id) => {
          if (isLikelyLookupId(id)) set.add(id);
        });
      });
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
      const rowId = String(row.rowId || row.id || '');
      const values = { ...row.values };
      sourceFields.forEach((f) => {
        const override = rowId ? getLookupDisplayOverride(rowId, f.key) : undefined;
        if (override !== undefined) {
          values[f.key] = override;
          return;
        }
        const raw = row.values?.[f.key];
        // Optimistic local save already wrote the label into the cell — keep it.
        if (raw && !Array.isArray(raw) && !isLikelyLookupId(raw)) {
          values[f.key] = raw;
          return;
        }
        const ids = idsOf(raw);
        if (ids.length === 0) return;
        const table = f.tableSource?.table;
        const text = ids.map((id) => {
          const seeded = textFromSeed(getLookupSeed(table, id), f.tableSource?.column, f.tableSource?.detailColumn);
          if (seeded !== null) return seeded;
          const hit = resolved[f.key]?.[id];
          return hit === undefined ? '…' : hit ? hit.text : MISSING_LABEL;
        });
        values[f.key] = Array.isArray(raw) ? text : text[0];
      });
      linked.forEach((l) => {
        const override = rowId ? getLookupDisplayOverride(rowId, l.key) : undefined;
        if (override !== undefined) {
          values[l.key] = override;
          return;
        }
        const [id] = idsOf(row.values?.[l.linkedFrom.fieldKey]);
        if (!id) {
          values[l.key] = '';
          return;
        }
        if (!isLikelyLookupId(id)) {
          // Source cell still holds a label; linked value waits for id restore.
          return;
        }
        const src = (fields || []).find((f) => f.key === l.linkedFrom.fieldKey);
        const seeded = getLookupSeed(src?.tableSource?.table, id);
        if (seeded && l.linkedFrom.column in seeded) {
          values[l.key] = seeded[l.linkedFrom.column] ?? '';
          return;
        }
        const hit = resolved[l.linkedFrom.fieldKey]?.[id];
        values[l.key] = hit === undefined ? '…' : hit ? hit.values[l.linkedFrom.column] ?? '' : MISSING_LABEL;
      });
      return { ...row, values, rawValues: row.values };
    });
    // seedTick / overrideTick re-read module maps after a picker selection
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, sourceFields, fields, resolved, seedTick, overrideTick]);
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
    // peek (not take): Strict Mode / remounts must not lose the pick before save finishes.
    const id = rowId ? peekLookupPick(String(rowId), f.key) : undefined;
    if (id === undefined) keep(f.key);
    else picked.push([f.key, id]);
  });
  picked.forEach(([key, id]) => {
    next[key] = id;
    Object.assign(next, groupSyncPatch(fields, key, id));
  });
  return next;
};
