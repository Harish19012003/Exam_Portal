import type { CellEditorProps } from '../types';
import {
  DynamicDatePicker,
  DynamicDateTimePicker,
  DynamicTimePicker,
  toDateValue,
  toDatetimeLocalValue,
  toTimeValue,
} from '../../DynamicData/fields';
import { asFieldColumn } from './shared';

export function DateEditor({ value, column, onSave, onCancel, isDarkMode, autoFocus }: CellEditorProps) {
  const field = asFieldColumn(column);

  return (
    <DynamicDatePicker
      value={toDateValue(value)}
      onChange={onSave}
      isDarkMode={isDarkMode}
      defaultOpen={!!autoFocus}
      variant="editor"
      required={field?.required}
      onCancel={onCancel}
      commitOnBlur
    />
  );
}

export function DateTimeEditor({ value, column, onSave, onCancel, isDarkMode, autoFocus }: CellEditorProps) {
  const field = asFieldColumn(column);

  return (
    <DynamicDateTimePicker
      value={toDatetimeLocalValue(value)}
      onChange={onSave}
      isDarkMode={isDarkMode}
      defaultOpen={!!autoFocus}
      variant="editor"
      required={field?.required}
      onCancel={onCancel}
      commitOnBlur
    />
  );
}

export function TimeEditor({ value, column, onSave, onCancel, isDarkMode, autoFocus }: CellEditorProps) {
  const field = asFieldColumn(column);

  return (
    <DynamicTimePicker
      value={toTimeValue(value)}
      onChange={onSave}
      isDarkMode={isDarkMode}
      defaultOpen={!!autoFocus}
      variant="editor"
      required={field?.required}
      onCancel={onCancel}
      commitOnBlur
    />
  );
}
