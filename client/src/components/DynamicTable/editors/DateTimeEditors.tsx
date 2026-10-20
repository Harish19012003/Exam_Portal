import { useEffect, useRef, useState } from 'react';
import type { CellEditorProps } from '../types';
import { editorBase, asFieldColumn } from './shared';

export function DateEditor({ value, column, onSave, onCancel, isDarkMode, autoFocus }: CellEditorProps) {
  const field = asFieldColumn(column);
  const [val, setVal] = useState(String(value ?? ''));
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => { if (autoFocus) { ref.current?.focus(); } }, [autoFocus]);

  const commit = () => {
    if (field?.required && !val) { return; }
    onSave(val || null);
  };

  return (
    <input
      ref={ref}
      type="date"
      value={val}
      onChange={e => setVal(e.target.value)}
      onBlur={commit}
      onKeyDown={e => {
        if (e.key === 'Enter') commit();
        if (e.key === 'Escape') onCancel();
      }}
      className={editorBase(isDarkMode) + ' px-0.5 tracking-tighter'}
      aria-label={`Edit ${column.label}`}
    />
  );
}

// ─── Time editor ───────────────────────────────────────────────────────────────

export function TimeEditor({ value, column, onSave, onCancel, isDarkMode, autoFocus }: CellEditorProps) {
  const field = asFieldColumn(column);
  const [val, setVal] = useState(String(value ?? ''));
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => { if (autoFocus) { ref.current?.focus(); } }, [autoFocus]);

  const commit = () => {
    if (field?.required && !val) { return; }
    onSave(val || null);
  };

  return (
    <input
      ref={ref}
      type="time"
      value={val}
      onChange={e => setVal(e.target.value)}
      onBlur={commit}
      onKeyDown={e => {
        if (e.key === 'Enter') commit();
        if (e.key === 'Escape') onCancel();
      }}
      className={editorBase(isDarkMode) + ' px-0.5 tracking-tighter'}
      aria-label={`Edit ${column.label}`}
    />
  );
}

