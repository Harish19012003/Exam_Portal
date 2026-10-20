import type { AggregationType, ColumnConfig, DataRow, DataType, FieldColumn } from '../types';
import { isFieldColumn } from '../types';

/** Resolve the effective type for aggregation / formatting (formulas use resultType). */
export function getEffectiveDataType(col: FieldColumn): DataType {
  if (col.dataType === 'formula') {
    return col.resultType || 'number';
  }
  return col.dataType;
}

/** Default footer aggregation for a column/result type. */
export function getDefaultAggregationForType(dataType: DataType): AggregationType | undefined {
  if (isNumericDataType(dataType)) return 'sum';
  if (isDateDataType(dataType) || dataType === 'time') return 'earliest';
  return undefined;
}

/**
 * Evaluate a formula column for a row.
 * Date/datetime formulas return serial day numbers (like Excel); call
 * `normalizeFormulaResult` before display or date aggregations.
 */
export function evaluateFormulaHelper(
  column: ColumnConfig,
  row: DataRow,
  allColumns: ColumnConfig[],
  visited = new Set<string>(),
): unknown {
  if (!isFieldColumn(column) || !column.formula) return undefined;
  if (visited.has(column.key)) return undefined;

  visited.add(column.key);
  try {
    let expr = column.formula;

    expr = expr.replace(/\b(\d+(?:\.\d+)?)(h|m|d)\b/gi, (_match, val, unit) => {
      const n = Number(val);
      const l = String(unit).toLowerCase();
      if (l === 'h') return `(${n}/24)`;
      if (l === 'm') return `(${n}/1440)`;
      return `(${n})`;
    });

    const matches = expr.match(/\{([a-zA-Z0-9_]+)\}/g);
    if (matches) {
      matches.forEach(m => {
        const key = m.replace(/[{}]/g, '');
        const refCol = allColumns.find(c => c.key === key);

        let replacement = '0';
        if (refCol) {
          if (refCol.dataType === 'formula') {
            const nestedVal = evaluateFormulaHelper(refCol, row, allColumns, visited);
            replacement =
              typeof nestedVal === 'string'
                ? JSON.stringify(nestedVal)
                : String(Number(nestedVal) || 0);
          } else {
            const valMap = (row?.values ?? row ?? {}) as Record<string, unknown>;
            const raw = valMap[key];
            if (refCol.dataType === 'date' || refCol.dataType === 'datetime') {
              const dateObj = new Date(String(raw));
              replacement = String(!isNaN(dateObj.getTime()) ? dateObj.getTime() / 86400000 : 0);
            } else if (['text', 'email', 'phone', 'dropdown', 'status'].includes(refCol.dataType)) {
              replacement = JSON.stringify(String(raw ?? ''));
            } else if (['boolean', 'checkbox'].includes(refCol.dataType)) {
              replacement = String(Boolean(raw));
            } else {
              replacement = String(Number(raw) || 0);
            }
          }
        }
        expr = expr.replace(m, replacement);
      });
    }

    expr = expr.replace(/TODAY\(\)/g, String(Math.floor(Date.now() / 86400000)));
    expr = expr.replace(/NOW\(\)/g, String(Date.now() / 86400000));

    const IF = (condition: unknown, trueVal: unknown, falseVal: unknown) =>
      condition ? trueVal : falseVal;
    const IFS = (...args: unknown[]) => {
      for (let i = 0; i < args.length; i += 2) {
        if (args[i]) return args[i + 1];
      }
      return undefined;
    };

    return new Function(
      'IF',
      'IFS',
      'ROUND',
      'MAX',
      'MIN',
      'ABS',
      'return ' + expr,
    )(IF, IFS, Math.round, Math.max, Math.min, Math.abs);
  } catch {
    return undefined;
  } finally {
    visited.delete(column.key);
  }
}

/** Convert formula serial dates to ms timestamps when resultType is date/datetime. */
export function normalizeFormulaResult(column: FieldColumn, computed: unknown): unknown {
  if (
    (column.resultType === 'date' || column.resultType === 'datetime') &&
    typeof computed === 'number' &&
    !isNaN(computed)
  ) {
    return computed * 86400000;
  }
  return computed;
}

/** Cell value for aggregation / export: stored value, or evaluated formula. */
export function getAggregatableValue(
  col: FieldColumn,
  row: DataRow,
  allColumns: ColumnConfig[],
): unknown {
  if (col.dataType === 'formula' && col.formula) {
    const computed = evaluateFormulaHelper(col, row, allColumns);
    if (computed === undefined) return undefined;
    return normalizeFormulaResult(col, computed);
  }
  const valMap = (row?.values ?? row ?? {}) as Record<string, unknown>;
  return valMap[col.key];
}

/** Comparable numeric value for temporal aggregations (date / datetime / time). */
export function toTemporalComparable(value: unknown, dataType: DataType): number | null {
  if (value === null || value === undefined || value === '') return null;

  if (typeof value === 'number' && !isNaN(value)) return value;

  const str = String(value);

  if (dataType === 'time') {
    const m = str.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (m) {
      return Number(m[1]) * 60 + Number(m[2]) + (m[3] ? Number(m[3]) / 60 : 0);
    }
    const d = new Date(str.includes('T') || str.includes(' ') ? str : `1970-01-01T${str}`);
    return isNaN(d.getTime()) ? null : d.getHours() * 60 + d.getMinutes();
  }

  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d.getTime();
}

export function isNumericDataType(dataType: DataType): boolean {
  return (
    dataType === 'number' ||
    dataType === 'currency' ||
    dataType === 'progress' ||
    dataType === 'rating'
  );
}

export function isDateDataType(dataType: DataType): boolean {
  return dataType === 'date' || dataType === 'datetime';
}

export function isTemporalDataType(dataType: DataType): boolean {
  return isDateDataType(dataType) || dataType === 'time';
}

export function isBooleanDataType(dataType: DataType): boolean {
  return dataType === 'boolean' || dataType === 'checkbox';
}

export function isTextLikeDataType(dataType: DataType): boolean {
  return (
    dataType === 'text' ||
    dataType === 'email' ||
    dataType === 'phone' ||
    dataType === 'link' ||
    dataType === 'dropdown' ||
    dataType === 'status'
  );
}
