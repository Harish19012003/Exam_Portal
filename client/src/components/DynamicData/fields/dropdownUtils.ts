import type { DataRow, FieldColumn } from '../../DynamicTable/types';

/** Resolve dropdown options, including dependent dropdown maps keyed by a parent field. */
export function resolveDropdownOptions(field: FieldColumn, row?: DataRow): string[] {
  let baseOptions: string[] = field.options ?? field.selectOptions ?? [];

  if (field.parentColumnKey && field.dependentOptionsMap) {
    const parentValue = String(row?.values?.[field.parentColumnKey] ?? '');
    if (parentValue && field.dependentOptionsMap[parentValue]) {
      baseOptions = field.dependentOptionsMap[parentValue];
    } else if (!parentValue) {
      baseOptions = Array.from(new Set(Object.values(field.dependentOptionsMap).flat()));
    } else {
      baseOptions = [];
    }
  }

  return baseOptions;
}

export function normalizeMultiSelectValue(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(v => String(v));
  if (typeof value === 'string' && value) {
    return value.split(',').map(s => s.trim()).filter(Boolean);
  }
  return [];
}
