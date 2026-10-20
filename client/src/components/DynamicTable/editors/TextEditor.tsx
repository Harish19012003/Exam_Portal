import { useEffect, useRef, useState } from 'react';
import type { CellEditorProps } from '../types';
import { editorBase, asFieldColumn } from './shared';

export function TextEditor({ value, column, onSave, onCancel, isDarkMode, autoFocus }: CellEditorProps) {
  const field = asFieldColumn(column);
  const [val, setVal] = useState(String(value ?? ''));
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => { if (autoFocus) { ref.current?.focus(); ref.current?.select(); } }, [autoFocus]);

  const validate = (v: string) => {
    if (field?.required && !v.trim()) return 'Required';
    if (field?.maxLength && v.length > field.maxLength) return `Max ${field.maxLength} chars`;
    return null;
  };

  const commit = () => {
    const err = validate(val);
    if (err) { setError(err); return; }
    onSave(val.trim());
  };

  return (
    <div className="relative w-full">
      <input
        ref={ref}
        value={val}
        onChange={e => { setVal(e.target.value); setError(null); }}
        onKeyDown={e => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') onCancel();
        }}
        onBlur={commit}
        className={editorBase(isDarkMode) + (error ? ' border-red-500' : '')}
        aria-label={`Edit ${column.label}`}
      />
      {error && (
        <span className="absolute -bottom-5 left-0 text-[10px] text-red-500 font-medium whitespace-nowrap">
          {error}
        </span>
      )}
    </div>
  );
}

// ─── Number / Currency editor ─────────────────────────────────────────────────
