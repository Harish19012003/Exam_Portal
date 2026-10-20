import { useState } from 'react';
import type { CellEditorProps } from '../types';
import { isCompositeColumn } from '../types';


export function CompositeEditor({ row, column, onSaveBatch, onCancel, isDarkMode }: CellEditorProps) {
  const [updates, setUpdates] = useState<Record<string, unknown>>({});

  if (!isCompositeColumn(column)) return null;

  const handleUpdate = (field: string, val: unknown) => {
    setUpdates(prev => ({ ...prev, [field]: val }));
  };

  const commit = () => {
    if (Object.keys(updates).length > 0 && onSaveBatch) {
      onSaveBatch(updates);
    } else {
      onCancel();
    }
  };

  return (
    <div className={`p-4 rounded-xl shadow-2xl border w-72 flex flex-col gap-4
      ${isDarkMode ? 'bg-[#0B1E19] border-[#13C296]/30 shadow-black/50' : 'bg-white border-gray-200 shadow-xl'}`}>
      <div className="flex justify-between items-center mb-1">
        <span className={`text-[13px] font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Edit {column.label}</span>
      </div>
      
      {column.composedOf.map(p => {
        const rowVals = (row?.values ?? row ?? {}) as Record<string, unknown>;
        const val = updates[p.field] !== undefined ? updates[p.field] : rowVals[p.field];
        return (
          <div key={p.field} className="flex flex-col gap-1.5">
            <label className={`text-[11px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              {p.role}
            </label>
            <input
              type="text"
              value={String(val ?? '')}
              onChange={e => handleUpdate(p.field, e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') commit();
                if (e.key === 'Escape') onCancel();
              }}
              className={`w-full px-3 py-1.5 text-[13px] font-medium outline-none rounded-lg border transition-all
                ${isDarkMode ? 'bg-gray-800/50 border-gray-700 text-gray-100 focus:border-[#13C296]' : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-[#13C296]'}`}
            />
          </div>
        );
      })}
      <div className="flex gap-2 justify-end mt-2 pt-4 border-t border-gray-200 dark:border-gray-800">
        <button onClick={onCancel} className={`px-4 py-1.5 text-[12px] font-bold rounded-lg transition-colors ${isDarkMode ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-800' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}>Cancel</button>
        <button onClick={commit} className="px-4 py-1.5 text-[12px] font-bold rounded-lg bg-[#13C296] text-white hover:bg-[#0f9f7a] transition-colors shadow-sm">Save Changes</button>
      </div>
    </div>
  );
}

// ─── Progress Editor ──────────────────────────────────────────────────────────
