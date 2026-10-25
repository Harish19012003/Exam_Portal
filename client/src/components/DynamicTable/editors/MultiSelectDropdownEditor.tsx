import type { CellEditorProps } from '../types';
import { DynamicMultiSelectDropdown, normalizeMultiSelectValue, resolveDropdownOptions } from '../../DynamicData/fields';
import { asFieldColumn } from './shared';

export function MultiSelectDropdownEditor({ value, row, column, onSave, onCancel, isDarkMode, autoFocus }: CellEditorProps) {
  const field = asFieldColumn(column);
  const options = field ? resolveDropdownOptions(field, row) : [];

  return (
    <DynamicMultiSelectDropdown
      value={normalizeMultiSelectValue(value)}
      onChange={onSave}
      options={options}
      isDarkMode={isDarkMode}
      defaultOpen={!!autoFocus}
      variant="editor"
      allowCustom={field?.allowCustom}
      onCancel={onCancel}
      commitOnBlur
    />
  );
}
