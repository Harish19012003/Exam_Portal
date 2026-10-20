import type { CellEditorProps, FieldColumn } from '../types';
import { isFieldColumn } from '../types';
import { fieldInputClass } from '../../../shared/fields/fieldStyles';

export function editorBase(isDarkMode: boolean, hasError = false) {
  return fieldInputClass(isDarkMode, hasError ? 'error' : 'default', { compact: true, variant: 'editor' });
}

export function asFieldColumn(column: CellEditorProps['column']): FieldColumn | null {
  return isFieldColumn(column) ? column : null;
}
