import type { CellEditorProps } from '../types';


export function BooleanEditor({ value, column, onSave, isDarkMode }: CellEditorProps) {
  const checked = Boolean(value);
  return (
    <div className="flex items-center justify-center w-full h-full cursor-pointer px-2" onClick={() => onSave(!checked)}>
      <button
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors outline-none focus:ring-2 focus:ring-[#13C296] focus:ring-offset-1 ${isDarkMode ? 'focus:ring-offset-gray-800' : ''} ${checked ? 'bg-[#13C296]' : (isDarkMode ? 'bg-gray-700' : 'bg-gray-300')}`}
        aria-label={`Toggle ${column.label}`}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
      </button>
    </div>
  );
}
