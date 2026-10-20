import type { AggregationType, ColumnConfig, DataType, FieldColumn } from '../types';
import { isFieldColumn } from '../types';
import { formatDate, formatDatetime, formatNumber, formatTime } from '../utils';
import {
  getDefaultAggregationForType,
  getEffectiveDataType,
  isBooleanDataType,
  isNumericDataType,
  isTemporalDataType,
} from './evaluateFormula';

export const AGGREGATION_LABELS: Record<AggregationType, string> = {
  sum: 'Sum',
  avg: 'Average',
  median: 'Median',
  min: 'Minimum',
  max: 'Maximum',
  earliest: 'Earliest',
  latest: 'Latest',
  range: 'Date range',
  count: 'Count all',
  countUnique: 'Count unique',
  empty: 'Empty',
  filled: 'Filled',
  percentEmpty: 'Percent empty',
  percentFilled: 'Percent filled',
  percentChecked: 'Percent checked',
};

const NUMERIC_AGGS: AggregationType[] = ['sum', 'avg', 'min', 'max', 'median'];

function formatTemporalAgg(effectiveType: DataType, agg: AggregationType, aggValue: number): string {
  if (agg === 'range') {
    if (effectiveType === 'time') {
      const mins = Math.round(Math.abs(aggValue));
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return h > 0 ? `${h}h ${m}m` : `${m}m`;
    }
    const days = Math.floor(aggValue / (1000 * 60 * 60 * 24));
    if (days > 365) return `${(days / 365).toFixed(1)} years`;
    if (days > 30) return `${(days / 30).toFixed(1)} months`;
    return `${days} days`;
  }

  // earliest / latest
  if (effectiveType === 'time') {
    // aggValue is minutes since midnight
    const h = Math.floor(aggValue / 60) % 24;
    const m = Math.round(aggValue % 60);
    return formatTime(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  }
  if (effectiveType === 'datetime') {
    return formatDatetime(aggValue);
  }
  return formatDate(aggValue);
}

export function formatAggregationValue(col: FieldColumn, aggValue: number): string {
  const agg = col.aggregation;
  if (!agg) return String(aggValue);

  // Formula columns follow resultType (number → number footer, currency → currency, …)
  const effectiveType = getEffectiveDataType(col);

  if (agg === 'earliest' || agg === 'latest' || agg === 'range') {
    return formatTemporalAgg(effectiveType, agg, aggValue);
  }
  if (agg === 'percentEmpty' || agg === 'percentFilled' || agg === 'percentChecked') {
    return `${aggValue.toFixed(1)}%`;
  }
  if (agg === 'countUnique') return `${aggValue} unique`;
  if (agg === 'empty') return `${aggValue} empty`;
  if (agg === 'filled') return `${aggValue} filled`;
  if (agg === 'count') return formatNumber(aggValue);

  if (NUMERIC_AGGS.includes(agg)) {
    switch (effectiveType) {
      case 'currency':
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          maximumFractionDigits: 0,
        }).format(aggValue);
      case 'progress':
        return `${Number(aggValue).toFixed(1)}%`;
      case 'number':
      case 'rating':
        return formatNumber(aggValue);
      default:
        if (isNumericDataType(effectiveType)) {
          return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(aggValue);
        }
    }
  }

  return String(aggValue);
}

export function formatAggregationLabel(agg: AggregationType | undefined): string {
  if (!agg) return 'None';
  return AGGREGATION_LABELS[agg];
}

/**
 * Footer aggregation options for a column.
 * Formula columns use resultType so they match that type’s normal column footer.
 */
export function getAggregationOptionsForColumn(col: FieldColumn): AggregationType[] {
  const opts: AggregationType[] = [];
  const effectiveType = getEffectiveDataType(col);

  if (isNumericDataType(effectiveType)) {
    // number | currency | percent(progress) | rating
    opts.push('sum', 'avg', 'median', 'min', 'max');
  } else if (isTemporalDataType(effectiveType)) {
    // date | datetime | time
    opts.push('earliest', 'latest', 'range');
  } else if (isBooleanDataType(effectiveType)) {
    opts.push('percentChecked');
  }
  // text-like: only count / fill stats below

  if (!isBooleanDataType(effectiveType)) {
    opts.push('countUnique');
  }

  opts.push('empty', 'filled', 'percentEmpty', 'percentFilled', 'count');
  return opts;
}

/** Pick a valid aggregation when result type changes (or keep current if still valid). */
export function resolveAggregationForResultType(
  resultType: DataType,
  current?: AggregationType,
): AggregationType | undefined {
  const fakeCol = {
    key: '_',
    label: '_',
    order: 0,
    visible: true,
    pinned: null,
    width: 100,
    dataType: 'formula' as const,
    resultType,
    aggregation: current,
  };
  const allowed = getAggregationOptionsForColumn(fakeCol);
  if (current && allowed.includes(current)) return current;
  return getDefaultAggregationForType(resultType);
}

export { getDefaultAggregationForType };

/** Build clipboard text for all visible column aggregations. */
export function buildCalculationsClipboardText(
  columns: ColumnConfig[],
  aggregations: Record<string, number>,
): string | null {
  const parts: string[] = [];
  columns.filter(c => c.visible).forEach(col => {
    if (!isFieldColumn(col) || !col.aggregation) return;
    const aggValue = aggregations[col.key];
    if (aggValue === undefined) return;
    const label = formatAggregationLabel(col.aggregation);
    parts.push(`${col.label} ${label}: ${formatAggregationValue(col, aggValue)}`);
  });
  return parts.length > 0 ? parts.join(' | ') : null;
}
