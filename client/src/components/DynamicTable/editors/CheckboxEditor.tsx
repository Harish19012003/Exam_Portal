import type { CellEditorProps } from '../types';

export function CheckboxEditor({ value, column, onSave, isDarkMode }: CellEditorProps) {
  const checked = Boolean(value);
  return (
    <div className="flex items-center justify-center w-full h-full cursor-pointer px-2" onClick={() => onSave(!checked)}>
      <button
        className={`flex items-center justify-center w-5 h-5 rounded border transition-colors outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[#13C296] focus-visible:ring-offset-1 ${isDarkMode ? 'focus-visible:ring-offset-gray-800 border-gray-600' : 'border-gray-300'} ${checked ? 'bg-[#13C296] border-[#13C296]' : (isDarkMode ? 'bg-gray-800' : 'bg-white')}`}
        aria-label={`Toggle ${column.label}`}
      >
        {checked && (
          <svg className="w-3.5 h-3.5 text-white pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>
    </div>
  );
}

// ─── Dispatcher ───────────────────────────────────────────────────────────────
