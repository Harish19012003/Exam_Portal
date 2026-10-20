import { useEffect, useRef, useState } from 'react';
import type { CellEditorProps } from '../types';
import { editorBase } from './shared';


export function TagsEditor({ value, onSave, onCancel, isDarkMode, autoFocus }: CellEditorProps) {
  const initialStr = Array.isArray(value) ? value.join(', ') : String(value ?? '');
  const [val, setVal] = useState(initialStr);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => { if (autoFocus) { ref.current?.focus(); ref.current?.select(); } }, [autoFocus]);

  const commit = () => {
    const tagsArray = val.split(',').map(s => s.trim()).filter(Boolean);
    onSave(tagsArray);
  };

  return (
    <div className="relative w-full">
      <input
        ref={ref}
        value={val}
        placeholder="tag1, tag2..."
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') onCancel();
        }}
        onBlur={commit}
        className={editorBase(isDarkMode)}
      />
    </div>
  );
}

// ─── Attachment Editor ────────────────────────────────────────────────────────
