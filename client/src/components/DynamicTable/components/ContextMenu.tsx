import { useEffect, useRef } from 'react';
import { Edit2, Trash2, Copy, X, Layers } from 'lucide-react';

interface ContextMenuProps {
  x: number;
  y: number;
  rowId: string;
  hasMultipleSelected: boolean;
  selectedCount: number;
  isDarkMode: boolean;
  onEdit: () => void;
  onEditSelected?: () => void;
  onBulkUpdate?: () => void;
  onDelete: () => void;
  onDeleteSelected: () => void;
  onClose: () => void;
}

export function ContextMenu({
  x, y, rowId: _rowId, hasMultipleSelected, selectedCount, isDarkMode,
  onEdit,
  onEditSelected,
  onBulkUpdate,
  onDelete, onDeleteSelected, onClose,
}: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click or Escape
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  // Keep menu in viewport
  const adjustedX = Math.min(x, window.innerWidth - 200);
  const adjustedY = Math.min(y, window.innerHeight - 220);

  const itemCls = `flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium cursor-pointer transition-colors w-full text-left
    ${isDarkMode
      ? 'text-gray-300 hover:bg-gray-800 hover:text-white'
      : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'}`;

  const dangerCls = `flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium cursor-pointer transition-colors w-full text-left
    ${isDarkMode
      ? 'text-red-400 hover:bg-red-900/30'
      : 'text-red-600 hover:bg-red-50'}`;

  return (
    <div
      ref={ref}
      style={{ position: 'fixed', left: adjustedX, top: adjustedY, zIndex: 9999 }}
      className={`min-w-[185px] rounded-xl border shadow-xl py-1 px-1 animate-[fadeIn_0.1s_ease-out]
        ${isDarkMode ? 'bg-gray-900 border-gray-700/80 shadow-black/40' : 'bg-white border-gray-200 shadow-gray-200/80'}`}
      role="menu"
      aria-label="Row actions"
    >
      {/* Row label */}
      <div className={`px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider
        ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
        Row actions
      </div>

      <button className={itemCls} onClick={onEdit} role="menuitem">
        <Edit2 className="w-3.5 h-3.5" aria-hidden="true" />
        Edit row
      </button>

      <button className={itemCls} onClick={onClose} role="menuitem">
        <Copy className="w-3.5 h-3.5" aria-hidden="true" />
        Duplicate row
      </button>

      {hasMultipleSelected && onEditSelected && (
        <button className={itemCls} onClick={onEditSelected} role="menuitem">
          <Edit2 className="w-3.5 h-3.5" aria-hidden="true" />
          Edit {selectedCount} selected rows
        </button>
      )}

      {hasMultipleSelected && onBulkUpdate && (
        <button className={itemCls} onClick={onBulkUpdate} role="menuitem">
          <Layers className="w-3.5 h-3.5" aria-hidden="true" />
          Bulk update {selectedCount} rows
        </button>
      )}

      <div className={`my-1 h-px mx-2 ${isDarkMode ? 'bg-gray-800' : 'bg-gray-100'}`} />

      <button className={dangerCls} onClick={onDelete} role="menuitem">
        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
        Delete this row
      </button>

      {hasMultipleSelected && (
        <button className={dangerCls} onClick={onDeleteSelected} role="menuitem">
          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
          Delete {selectedCount} selected rows
        </button>
      )}

      <div className={`my-1 h-px mx-2 ${isDarkMode ? 'bg-gray-800' : 'bg-gray-100'}`} />

      <button className={itemCls} onClick={onClose} role="menuitem">
        <X className="w-3.5 h-3.5" aria-hidden="true" />
        Cancel
      </button>
    </div>
  );
}
