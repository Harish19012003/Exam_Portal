import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export function TitleCombobox({
  value,
  onChange,
  suggestions,
  isDarkMode,
}: {
  value: string;
  onChange: (v: string) => void;
  suggestions: string[];
  isDarkMode: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const filtered = suggestions.filter(
    s => s.toLowerCase().includes(value.toLowerCase()) && s !== value
  );

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const inputCls = `w-full px-3 py-2.5 rounded-xl border text-[13px] outline-none transition-all pr-9
    focus:ring-2 focus:ring-[#13C296]/20 focus:border-[#13C296]
    ${isDarkMode
      ? 'bg-black/20 border-gray-700 text-gray-200 placeholder-gray-600'
      : 'bg-white border-gray-200 text-gray-800 placeholder-gray-400'}`;

  return (
    <div ref={ref} className="relative">
      <input
        autoFocus
        value={value || ''}
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder="e.g. Person, Location, Contact…"
        className={inputCls}
        aria-label="Column title"
        aria-autocomplete="list"
        aria-expanded={open && filtered.length > 0}
      />
      {/* Chevron toggle */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={`absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded transition-colors
          ${isDarkMode ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'}`}
        aria-label="Show title suggestions"
        tabIndex={-1}
      >
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {open && (filtered.length > 0 || (!value && suggestions.length > 0)) && (
        <ul
          role="listbox"
          className={`absolute left-0 right-0 top-full mt-1.5 rounded-xl border shadow-xl z-50 py-1 overflow-y-auto max-h-48
            ${isDarkMode ? 'bg-[#0B1E19] border-[#13C296]/20 shadow-black/50' : 'bg-white border-gray-200'}`}
        >
          {(value ? filtered : suggestions).map(s => (
            <li
              key={s}
              role="option"
              aria-selected={s === value}
              onMouseDown={e => { e.preventDefault(); onChange(s); setOpen(false); }}
              className={`flex items-center justify-between px-3 py-2 cursor-pointer text-[13px] transition-colors
                ${isDarkMode
                  ? 'text-gray-300 hover:bg-white/10'
                  : 'text-gray-700 hover:bg-gray-50'}`}
            >
              <span>{s}</span>
              {s === value && <Check className="w-3.5 h-3.5 text-[#13C296]" aria-hidden="true" />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
