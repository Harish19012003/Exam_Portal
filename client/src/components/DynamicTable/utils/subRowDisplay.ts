import type { ColumnConfig, DataRow, SubRowsConfig } from '../types';
import { hasSubRows } from './flattenRows';

/** True when this parent renders sub-rows in a nested panel (different schema). */
export function usesNestedSubRowPanel(row: DataRow, config?: SubRowsConfig): boolean {
  if (!hasSubRows(row)) return false;
  if (!config) return true; // Default to showing sub-table when subRows exist
  if (config.getRenderSubRows?.(row) || config.renderSubRows) return true;
  if ((config.getSubRowColumns?.(row)?.length ?? 0) > 0) return true;
  if (config.mode === 'nested') return true;
  return true;
}

export function resolveSubRowColumns(
  parentRow: DataRow,
  config?: SubRowsConfig,
): ColumnConfig[] {
  const configuredCols =
    config?.getSubRowColumns?.(parentRow) ??
    config?.subRowColumns;

  if (configuredCols && configuredCols.length > 0) {
    return configuredCols;
  }

  // Auto-generate columns from subRows values if no explicit schema is configured
  if (parentRow.subRows && parentRow.subRows.length > 0) {
    const firstSubRow = parentRow.subRows[0];
    const keys = Object.keys(firstSubRow.values || {});
    return keys.map((key, idx) => {
      const lowerKey = key.toLowerCase();
      const val = firstSubRow.values[key];
      let dataType: ColumnConfig['dataType'] = 'text';

      if (lowerKey.includes('status') || lowerKey.includes('priority') || lowerKey.includes('risk')) {
        dataType = 'status';
      } else if (lowerKey.includes('completion') || lowerKey.includes('progress')) {
        dataType = 'progress';
      } else if (lowerKey.includes('budget') || lowerKey.includes('spent') || lowerKey.includes('rate') || lowerKey.includes('cost') || lowerKey.includes('price') || lowerKey.includes('salary') || lowerKey.includes('total')) {
        dataType = 'currency';
      } else if (lowerKey.includes('date')) {
        dataType = 'date';
      } else if (lowerKey.includes('url') || lowerKey.includes('link')) {
        dataType = 'link';
      } else if (lowerKey.startsWith('is_') || typeof val === 'boolean') {
        dataType = 'boolean';
      } else if (typeof val === 'number') {
        dataType = 'number';
      }

      let width = 140;
      if (lowerKey.includes('name') || lowerKey.includes('title') || lowerKey.includes('desc') || lowerKey.includes('notes')) {
        width = 220;
      } else if (lowerKey.includes('id') || lowerKey.includes('status') || lowerKey.includes('date') || lowerKey.includes('priority') || lowerKey.includes('risk') || lowerKey.startsWith('is_')) {
        width = 120;
      } else if (lowerKey.includes('owner') || lowerKey.includes('assignee') || lowerKey.includes('department') || lowerKey.includes('category') || lowerKey.includes('sprint')) {
        width = 150;
      } else if (lowerKey.includes('completion') || lowerKey.includes('progress') || lowerKey.includes('hours') || lowerKey.includes('rate')) {
        width = 130;
      }




      return {
        key,
        label: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '),
        dataType,
        order: idx + 1,
        visible: true,
        pinned: null,
        width,
      };
    });


  }

  return [];
}

export function resolveRenderSubRows(
  parentRow: DataRow,
  config?: SubRowsConfig,
): SubRowsConfig['renderSubRows'] {
  if (!config) return undefined;
  return config.getRenderSubRows?.(parentRow) ?? config.renderSubRows;
}

