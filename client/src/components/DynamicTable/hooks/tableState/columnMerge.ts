import type { ColumnConfig } from '../../types';
import { isFieldColumn } from '../../types';
import { readPref } from '../../utils/prefsStorage';

export function mergeSavedColumns(saved: ColumnConfig[], initialColumns: ColumnConfig[]): ColumnConfig[] {
  const merged: ColumnConfig[] = saved.map(sCol => {
    const initCol = initialColumns.find(c => c.key === sCol.key);
    if (!initCol) return sCol;

    if (sCol.dataType === 'formula' || initCol.dataType === 'formula') {
      const sField = isFieldColumn(sCol) ? sCol : null;
      const iField = isFieldColumn(initCol) ? initCol : null;
      return {
        key: sCol.key,
        label: initCol.label,
        description: sCol.description ?? initCol.description,
        order: sCol.order,
        visible: sCol.visible,
        pinned: sCol.pinned,
        width: sCol.width,
        dataType: 'formula',
        formula: sField?.formula ?? iField?.formula,
        resultType: sField?.resultType ?? iField?.resultType ?? 'number',
        aggregation: sField?.aggregation ?? iField?.aggregation,
        editable: false,
      } satisfies ColumnConfig;
    }

    if (isFieldColumn(initCol) && isFieldColumn(sCol)) {
      return {
        ...sCol,
        options: initCol.options,
        label: initCol.label,
        dataType: initCol.dataType,
        aggregation: initCol.aggregation,
      };
    }

    return { ...sCol, label: initCol.label };
  });

  const unique: ColumnConfig[] = [];
  const seen = new Set<string>();
  for (const col of merged) {
    if (!seen.has(col.key)) {
      seen.add(col.key);
      unique.push(col);
    }
  }
  return unique;
}

export function loadInitialColumns(initialColumns: ColumnConfig[]): ColumnConfig[] {
  const saved: ColumnConfig[] = readPref('columns', initialColumns);
  return mergeSavedColumns(saved, initialColumns);
}

export interface ColumnSyncPatch {
  columns: ColumnConfig[];
  newColKeys: string[];
  staleKeys: Set<string>;
}

export function syncColumnsWithInitial(
  prev: ColumnConfig[],
  initialColumns: ColumnConfig[],
): ColumnSyncPatch | null {
  const initialKeys = new Set(initialColumns.map(c => c.key));
  const existingKeys = new Set(prev.map(c => c.key));

  const newCols = initialColumns.filter(c => !existingKeys.has(c.key));
  const staleKeys = new Set(
    prev.filter(c => !initialKeys.has(c.key) && c.dataType !== 'composite' && c.dataType !== 'formula').map(c => c.key),
  );
  let next = prev.filter(c => !staleKeys.has(c.key));
  next = [...next, ...newCols];

  let hasChanges = newCols.length > 0 || staleKeys.size > 0;
  next = next.map(col => {
    const initCol = initialColumns.find(c => c.key === col.key);
    if (!initCol) return col;

    if (col.dataType === 'formula' || initCol.dataType === 'formula') {
      if (col.label !== initCol.label) {
        hasChanges = true;
        return { ...col, label: initCol.label };
      }
      return col;
    }

    const initOptions = isFieldColumn(initCol) ? initCol.options : undefined;
    const initAgg = isFieldColumn(initCol) ? initCol.aggregation : undefined;
    const colOptions = isFieldColumn(col) ? col.options : undefined;
    const colAgg = isFieldColumn(col) ? col.aggregation : undefined;

    if (
      JSON.stringify(colOptions) !== JSON.stringify(initOptions) ||
      col.label !== initCol.label ||
      col.dataType !== initCol.dataType ||
      colAgg !== initAgg
    ) {
      hasChanges = true;
      if (isFieldColumn(col) && isFieldColumn(initCol)) {
        return {
          ...col,
          options: initOptions,
          label: initCol.label,
          dataType: initCol.dataType,
          aggregation: initAgg,
        };
      }
      return { ...col, label: initCol.label };
    }
    return col;
  });

  if (!hasChanges) return null;
  return { columns: next, newColKeys: newCols.map(c => c.key), staleKeys };
}
