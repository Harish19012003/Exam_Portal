/**
 * Pure helpers for "unsaved table changes".
 *
 * The personal layout (order, visibility, widths, density, footer totals, highlight rules) is compared
 * against the last SAVED copy. Anything different is an unsaved change: it is kept as a browser draft
 * and the bottom bar asks the user to Save or Discard.
 */
import type { AggregationType, ColumnConfig, ConditionalFormatRule } from '../types';

export interface LayoutSlice {
  columnOrder?: string[];
  columnVisibility?: Record<string, boolean>;
  columnWidths?: Record<string, number>;
  density?: string;
  /** Footer totals that differ from the page schema. `null` means "removed". */
  columnAggregations?: Record<string, AggregationType | null>;
  conditionalFormats?: ConditionalFormatRule[];
}

type AggColumn = Pick<ColumnConfig, 'key' | 'aggregation'>;

/** JSON with sorted object keys and no `undefined`, so equal data always gives an equal string. */
export function stableStringify(value: unknown): string {
  if (value === undefined) {
    return 'null';
  }
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`;
}

const roundWidths = (widths?: Record<string, number>): Record<string, number> => {
  const out: Record<string, number> = {};
  Object.entries(widths || {}).forEach(([key, value]) => {
    const n = Number(value);
    if (Number.isFinite(n) && n > 0) {
      out[key] = Math.round(n);
    }
  });
  return out;
};

/** Normalised copy used for comparing and for sending to the server. */
export function normalizeLayoutSlice(slice: LayoutSlice | null | undefined): LayoutSlice {
  const s = slice || {};
  return {
    columnOrder: Array.isArray(s.columnOrder) ? [...s.columnOrder] : [],
    columnVisibility: { ...(s.columnVisibility || {}) },
    columnWidths: roundWidths(s.columnWidths),
    density: s.density || '',
    columnAggregations: { ...(s.columnAggregations || {}) },
    conditionalFormats: Array.isArray(s.conditionalFormats) ? s.conditionalFormats : [],
  };
}

export function layoutSignature(slice: LayoutSlice | null | undefined): string {
  return stableStringify(normalizeLayoutSlice(slice));
}

/** Footer totals that differ from the schema defaults (`null` = the user removed a default total). */
export function diffAggregations(
  columns: AggColumn[],
  schema: AggColumn[],
): Record<string, AggregationType | null> {
  const schemaByKey = new Map(schema.map((c) => [c.key, c.aggregation ?? null]));
  const out: Record<string, AggregationType | null> = {};
  columns.forEach((col) => {
    if (!schemaByKey.has(col.key)) {
      // Columns added in the table itself (formula / composite): remember their total if they have one.
      if (col.aggregation) {
        out[col.key] = col.aggregation;
      }
      return;
    }
    const wanted = col.aggregation ?? null;
    if (wanted !== schemaByKey.get(col.key)) {
      out[col.key] = wanted;
    }
  });
  return out;
}

/** Apply saved footer totals over the schema columns. Returns the same array when nothing changes. */
export function applyAggregations<T extends AggColumn>(
  columns: T[],
  map?: Record<string, AggregationType | null> | null,
): T[] {
  if (!map || Object.keys(map).length === 0) {
    return columns;
  }
  let changed = false;
  const next = columns.map((col) => {
    if (!Object.prototype.hasOwnProperty.call(map, col.key)) {
      return col;
    }
    const wanted = map[col.key] ?? undefined;
    if ((col.aggregation ?? undefined) === wanted) {
      return col;
    }
    changed = true;
    return { ...col, aggregation: wanted };
  });
  return changed ? next : columns;
}

const widthsDiffer = (a: Record<string, number>, b: Record<string, number>): boolean => {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if (a[key] !== b[key]) {
      return true;
    }
  }
  return false;
};

/** Human labels for what differs, shown in the bar ("column widths, footer totals"). */
export function summarizeLayoutChanges(current: LayoutSlice, baseline: LayoutSlice): string[] {
  const a = normalizeLayoutSlice(current);
  const b = normalizeLayoutSlice(baseline);
  const labels: string[] = [];
  if (stableStringify(a.columnOrder) !== stableStringify(b.columnOrder)) {
    labels.push('column order');
  }
  if (widthsDiffer(a.columnWidths as Record<string, number>, b.columnWidths as Record<string, number>)) {
    labels.push('column widths');
  }
  if (stableStringify(a.columnVisibility) !== stableStringify(b.columnVisibility)) {
    labels.push('visible columns');
  }
  if (a.density !== b.density) {
    labels.push('row density');
  }
  if (stableStringify(a.columnAggregations) !== stableStringify(b.columnAggregations)) {
    labels.push('footer totals');
  }
  if (stableStringify(a.conditionalFormats) !== stableStringify(b.conditionalFormats)) {
    labels.push('highlight rules');
  }
  return labels;
}
