import type { CellEditorProps } from '../types';
import { DynamicDropdown, resolveDropdownOptions } from '../../DynamicData/fields';
import { asFieldColumn } from './shared';

export function DropdownEditor({ value, row, column, onSave, onCancel, isDarkMode, autoFocus }: CellEditorProps) {
  const field = asFieldColumn(column);
  const options = field ? resolveDropdownOptions(field, row) : [];

  return (
    <DynamicDropdown
      value={String(value ?? '')}
      onChange={onSave}
      options={options}
      isDarkMode={isDarkMode}
      defaultOpen={!!autoFocus}
      variant="editor"
      allowCustom={field?.allowCustom}
      required={field?.required}
      onCancel={onCancel}
      commitOnBlur
    />
  );
}
