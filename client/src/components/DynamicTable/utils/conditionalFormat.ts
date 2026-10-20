import type { CSSProperties } from 'react';
import type {
  ColumnConfig,
  ConditionalFormatRule,
  ConditionalFormatStyle,
  DataRow,
  FormatFontWeight,
  FormatOp,
} from '../types';
import { isFieldColumn } from '../types';
import { evaluateFormulaHelper, getAggregatableValue } from './evaluateFormula';

const FONT_WEIGHT_CSS: Record<FormatFontWeight, number> = {
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
};

export function styleToCss(style: ConditionalFormatStyle): CSSProperties {
  const css: CSSProperties = {};
  if (style.backgroundColor) css.backgroundColor = style.backgroundColor;
  if (style.color) css.color = style.color;
  if (style.fontWeight) css.fontWeight = FONT_WEIGHT_CSS[style.fontWeight];
  return css;
}

function isTruthy(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return !isNaN(value) && value !== 0;
  if (typeof value === 'string') return value.trim().length > 0;
  return Boolean(value);
}

/** Evaluate a free-form condition formula against a row (shared path with formula columns). */
export function evaluateConditionFormula(
  formula: string,
  row: DataRow,
  allColumns: ColumnConfig[],
): unknown {
  if (!formula.trim()) return undefined;
  const tempCol: ColumnConfig = {
    key: '__cf_condition__',
    label: 'Condition',
    order: -1,
    visible: false,
    pinned: null,
    width: 0,
    dataType: 'formula',
    formula,
    resultType: 'boolean',
    editable: false,
  };
  return evaluateFormulaHelper(tempCol, row, allColumns);
}

function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

function compareSimple(cellValue: unknown, op: FormatOp, ruleValue?: string | number | boolean): boolean {
  if (op === 'empty') return isEmptyValue(cellValue);
  if (op === 'notEmpty') return !isEmptyValue(cellValue);

  if (op === 'contains') {
    return String(cellValue ?? '')
      .toLowerCase()
      .includes(String(ruleValue ?? '').toLowerCase());
  }

  if (op === 'equals') {
    if (typeof ruleValue === 'boolean' || typeof cellValue === 'boolean') {
      return Boolean(cellValue) === Boolean(ruleValue);
    }
    if (typeof ruleValue === 'number' || typeof cellValue === 'number') {
      const a = Number(cellValue);
      const b = Number(ruleValue);
      if (!isNaN(a) && !isNaN(b)) return a === b;
    }
    return String(cellValue ?? '').toLowerCase() === String(ruleValue ?? '').toLowerCase();
  }

  const a = Number(cellValue);
  const b = Number(ruleValue);
  if (isNaN(a) || isNaN(b)) return false;
  if (op === 'gt') return a > b;
  if (op === 'gte') return a >= b;
  if (op === 'lt') return a < b;
  if (op === 'lte') return a <= b;
  return false;
}

export function ruleMatches(
  row: DataRow,
  rule: ConditionalFormatRule,
  columns: ColumnConfig[],
): boolean {
  if (!rule.enabled) return false;

  if (rule.conditionMode === 'formula') {
    try {
      const result = evaluateConditionFormula(rule.conditionFormula ?? '', row, columns);
      return isTruthy(result);
    } catch {
      return false;
    }
  }

  const whenKey = rule.whenColumnKey;
  if (!whenKey || !rule.op) return false;

  const col = columns.find(c => c.key === whenKey);
  if (!col || !isFieldColumn(col)) return false;

  const cellValue = getAggregatableValue(col, row, columns);
  return compareSimple(cellValue, rule.op, rule.value);
}

/** First matching enabled row-scope rule (list order). */
export function getRowFormatStyle(
  row: DataRow,
  rules: ConditionalFormatRule[],
  columns: ColumnConfig[],
): ConditionalFormatStyle | null {
  for (const rule of rules) {
    if (rule.scope !== 'row' || !rule.enabled) continue;
    if (ruleMatches(row, rule, columns)) return rule.style;
  }
  return null;
}

/** Resolve highlight column keys (supports legacy single targetColumnKey). */
export function getRuleTargetColumnKeys(rule: ConditionalFormatRule): string[] {
  if (rule.targetColumnKeys && rule.targetColumnKeys.length > 0) {
    return rule.targetColumnKeys;
  }
  if (rule.targetColumnKey) return [rule.targetColumnKey];
  return [];
}

/** Normalize prefs / legacy rules to the multi-target shape. */
export function normalizeConditionalFormatRule(rule: ConditionalFormatRule): ConditionalFormatRule {
  const keys = getRuleTargetColumnKeys(rule);
  const { targetColumnKey: _legacy, ...rest } = rule;
  return {
    ...rest,
    targetColumnKeys: rule.scope === 'cell' ? keys : undefined,
  };
}

/** First matching enabled cell-scope rule for this target column (list order). */
export function getCellFormatStyle(
  row: DataRow,
  colKey: string,
  rules: ConditionalFormatRule[],
  columns: ColumnConfig[],
): ConditionalFormatStyle | null {
  for (const rule of rules) {
    if (rule.scope !== 'cell' || !rule.enabled) continue;
    if (!getRuleTargetColumnKeys(rule).includes(colKey)) continue;
    if (ruleMatches(row, rule, columns)) return rule.style;
  }
  return null;
}

/** Merge row style under cell style (cell wins on overlapping keys). */
export function mergeFormatStyles(
  rowStyle: ConditionalFormatStyle | null,
  cellStyle: ConditionalFormatStyle | null,
): ConditionalFormatStyle | null {
  if (!rowStyle && !cellStyle) return null;
  return { ...rowStyle, ...cellStyle };
}

export const MAX_RECENT_FORMAT_COLORS = 10;

export function pushRecentColor(recent: string[], hex: string): string[] {
  const normalized = hex.trim().toLowerCase();
  if (!normalized) return recent;
  const next = [normalized, ...recent.filter(c => c.toLowerCase() !== normalized)];
  return next.slice(0, MAX_RECENT_FORMAT_COLORS);
}
