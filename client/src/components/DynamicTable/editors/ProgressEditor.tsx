import { useEffect, useRef, useState } from 'react';
import type { CellEditorProps } from '../types';


export function ProgressEditor({ value, onSave, onCancel, isDarkMode, autoFocus }: CellEditorProps) {
  const [val, setVal] = useState(Number(value) || 0);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => { if (autoFocus) ref.current?.focus(); }, [autoFocus]);

  const commit = () => onSave(Math.min(100, Math.max(0, val)));

  return (
    <div className="flex items-center w-full h-full px-2 gap-2 bg-transparent">
      <input
        ref={ref}
        type="range"
        min="0"
        max="100"
        value={val}
        onChange={e => setVal(Number(e.target.value))}
        onKeyDown={e => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') onCancel();
        }}
        onBlur={commit}
        className="flex-1 min-w-0 accent-[#13C296] outline-none bg-transparent cursor-pointer"
      />
      <span className={`flex-shrink-0 text-[12px] font-medium tabular-nums w-9 text-right ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>{val}%</span>
    </div>
  );
}

// ─── Rating Editor ────────────────────────────────────────────────────────────
