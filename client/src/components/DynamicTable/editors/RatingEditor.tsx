import { useEffect, useRef, useState } from 'react';
import { Icon } from '@iconify/react';
import type { CellEditorProps } from '../types';


export function RatingEditor({ value, onSave, onCancel, isDarkMode, autoFocus }: CellEditorProps) {
  const [val, setVal] = useState(Number(value) || 0);
  const [hoverVal, setHoverVal] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { if (autoFocus) ref.current?.focus(); }, [autoFocus]);

  const displayVal = hoverVal !== null ? hoverVal : val;

  return (
    <div 
      ref={ref}
      tabIndex={0}
      className={`flex items-center w-full h-full px-2 gap-1 outline-none bg-transparent`}
      onKeyDown={e => {
        if (e.key === 'Enter') onSave(val);
        if (e.key === 'Escape') onCancel();
        if (e.key === 'ArrowRight') setVal(Math.min(5, val + 1));
        if (e.key === 'ArrowLeft') setVal(Math.max(0, val - 1));
      }}
      onBlur={() => onSave(val)}
    >
      {[1, 2, 3, 4, 5].map(star => (
        <button
          key={star}
          type="button"
          onMouseEnter={() => setHoverVal(star)}
          onMouseLeave={() => setHoverVal(null)}
          onMouseDown={() => { setVal(star); onSave(star); }}
          className="focus:outline-none"
        >
          <Icon 
            icon="hugeicons:star" 
            className={`w-4 h-4 cursor-pointer transition-colors ${star <= displayVal ? 'text-amber-400 fill-amber-400' : (isDarkMode ? 'text-gray-600 hover:text-amber-400/50' : 'text-gray-300 hover:text-amber-400/50')}`} 
          />
        </button>
      ))}
    </div>
  );
}

// ─── Tags Editor ──────────────────────────────────────────────────────────────
