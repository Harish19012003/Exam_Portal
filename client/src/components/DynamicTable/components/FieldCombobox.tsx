import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Search } from 'lucide-react';
import type { ColumnConfig } from '../types';

export function FieldCombobox({
  value,
  onChange,
  fields,
  isDarkMode,
}: {
  value: string;
  onChange: (v: string) => void;
  fields: ColumnConfig[];
  isDarkMode: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [dropUp, setDropUp] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleOpen = () => {
    if (!open && ref.current) {
      const rect = ref.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      setDropUp(spaceBelow < 300); // Trigger drop-up if less than 300px below
      setSearch(''); // Reset search on open
    }
    setOpen(v => !v);
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Auto-focus search input when opened
  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  const selectedField = fields.find(f => f.key === value);
  const filteredFields = fields.filter(f => 
    f.label.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div ref={ref} className="relative w-full">
      <button
        type="button"
        onClick={handleOpen}
        className={`w-full h-[32px] px-2 flex items-center justify-between text-[13px] rounded-lg border transition-colors outline-none
          ${open ? 'ring-2 ring-[#13C296]/20 border-[#13C296]' : ''}
          ${isDarkMode
            ? 'bg-black/30 border-gray-700 text-gray-200 hover:bg-black/50'
            : 'bg-white border-gray-200 text-gray-800 hover:bg-gray-50'}`}
        aria-label="Select field"
      >
        <span className="truncate">{selectedField?.label || 'Pick a field…'}</span>
        <ChevronDown className={`w-3.5 h-3.5 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''} ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`} />
      </button>

      {open && (
        <div
          className={`absolute left-0 right-0 z-50 rounded-xl border shadow-xl flex flex-col overflow-hidden
            ${dropUp ? 'bottom-full mb-1.5' : 'top-full mt-1.5'}
            ${isDarkMode ? 'bg-[#0B1E19] border-[#13C296]/20 shadow-black/50' : 'bg-white border-gray-200 shadow-gray-200'}`}
        >
          {/* Search Input */}
          <div className={`flex items-center px-3 py-2 border-b ${isDarkMode ? 'border-[#13C296]/20' : 'border-gray-100'}`}>
            <Search className={`w-3.5 h-3.5 mr-2 flex-shrink-0 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`} />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search fields..."
              className={`w-full text-[13px] bg-transparent outline-none ${isDarkMode ? 'text-gray-200 placeholder-gray-500' : 'text-gray-800 placeholder-gray-400'}`}
            />
          </div>

          {/* Options List */}
          <ul role="listbox" className="p-1 overflow-y-auto max-h-48">
            {filteredFields.length > 0 ? (
              filteredFields.map(field => (
                <li
                  key={field.key}
                  role="option"
                  aria-selected={field.key === value}
                  onMouseDown={e => { e.preventDefault(); onChange(field.key); setOpen(false); }}
                  className={`flex items-center justify-between px-2 py-1.5 rounded-lg cursor-pointer text-[13px] transition-colors
                    ${isDarkMode
                      ? (field.key === value ? 'bg-[#13C296]/20 text-[#13C296]' : 'text-gray-300 hover:bg-white/10')
                      : (field.key === value ? 'bg-[#13C296]/10 text-[#13C296]' : 'text-gray-700 hover:bg-gray-50')}`}
                >
                  <span className="truncate">{field.label}</span>
                  {field.key === value && <Check className="w-3.5 h-3.5 text-[#13C296] flex-shrink-0" aria-hidden="true" />}
                </li>
              ))
            ) : (
              <li className={`px-2 py-3 text-center text-[12px] ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                No fields found.
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
