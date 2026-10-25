import type { AggregationType, ColumnConfig, DataRow, FieldColumn } from '../types';
import {
  getAggregatableValue,
  getEffectiveDataType,
  isBooleanDataType,
  isNumericDataType,
  isTemporalDataType,
  toTemporalComparable,
} from './evaluateFormula';

/** Compute one aggregation for a field over the given rows (typically the filtered set). */
export function computeAggregationValue(
  col: FieldColumn,
  rows: DataRow[],
  aggregation: AggregationType,
  allColumns: ColumnConfig[],
): number {
  const effectiveType = getEffectiveDataType(col);
  let sum = 0;
  let count = 0;
  let numericCount = 0;
  let emptyCount = 0;
  let min = Infinity;
  let max = -Infinity;
  const uniqueValues = new Set<unknown>();
  const numbersForMedian: number[] = [];
  let checkedCount = 0;

  for (const row of rows) {
    const rawVal = getAggregatableValue(col, row, allColumns);
    if (rawVal === null || rawVal === undefined || rawVal === '') {
      emptyCount++;
      continue;
    }

    count++;
    uniqueValues.add(rawVal);

    if (isBooleanDataType(effectiveType)) {
      if (rawVal === true) checkedCount++;
    } else if (isTemporalDataType(effectiveType)) {
      const d = toTemporalComparable(rawVal, effectiveType);
      if (d !== null) {
        if (d < min) min = d;
        if (d > max) max = d;
      }
    } else if (isNumericDataType(effectiveType)) {
      const val = Number(rawVal);
      if (!isNaN(val)) {
        sum += val;
        numericCount++;
        numbersForMedian.push(val);
        if (val < min) min = val;
        if (val > max) max = val;
      }
    }
  }

  switch (aggregation) {
    case 'sum':
      return sum;
    case 'avg':
      return numericCount > 0 ? sum / numericCount : 0;
    case 'min':
    case 'earliest':
      return count > 0 && min !== Infinity ? min : 0;
    case 'max':
    case 'latest':
      return count > 0 && max !== -Infinity ? max : 0;
    case 'range':
      return count > 0 && min !== Infinity ? max - min : 0;
    case 'count':
      return count;
    case 'countUnique':
      return uniqueValues.size;
    case 'empty':
      return emptyCount;
    case 'filled':
      return count;
    case 'percentEmpty':
      return rows.length > 0 ? (emptyCount / rows.length) * 100 : 0;
    case 'percentFilled':
      return rows.length > 0 ? (count / rows.length) * 100 : 0;
    case 'percentChecked':
      return rows.length > 0 ? (checkedCount / rows.length) * 100 : 0;
    case 'median': {
      if (numbersForMedian.length === 0) return 0;
      numbersForMedian.sort((a, b) => a - b);
      const mid = Math.floor(numbersForMedian.length / 2);
      return numbersForMedian.length % 2 !== 0
        ? numbersForMedian[mid]
        : (numbersForMedian[mid - 1] + numbersForMedian[mid]) / 2;
    }
    default:
      return 0;
  }
}
