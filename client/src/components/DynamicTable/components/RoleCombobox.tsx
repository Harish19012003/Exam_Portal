import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import type { CompositeRole } from '../types';

export const ROLES_OPTIONS: { value: CompositeRole; label: string; description: string }[] = [
  { value: 'primary', label: 'Primary', description: 'Top-line bold text' },
  { value: 'secondary', label: 'Secondary', description: 'Second-line muted text' },
  { value: 'tertiary', label: 'Tertiary', description: 'Third-line small text' },
  { value: 'avatar', label: 'Avatar', description: 'Profile image (circle)' },
  { value: 'icon', label: 'Icon', description: 'Small icon or flag' },
  { value: 'badge', label: 'Badge', description: 'Color badge pill' },
  { value: 'prefix', label: 'Prefix', description: 'Text before primary' },
  { value: 'suffix', label: 'Suffix', description: 'Text after primary' },
];

function RolePreview({ role }: { role: CompositeRole }) {
  switch (role) {
    case 'primary':
      return (
        <div className="flex flex-col gap-1">
          <div className="w-16 h-2.5 bg-current rounded opacity-80"></div>
          <div className="w-10 h-1.5 bg-current rounded opacity-20"></div>
        </div>
      );
    case 'secondary':
      return (
        <div className="flex flex-col gap-1">
          <div className="w-16 h-1.5 bg-current rounded opacity-20"></div>
          <div className="w-12 h-2 bg-current rounded opacity-60"></div>
        </div>
      );
    case 'tertiary':
      return (
        <div className="flex flex-col gap-1">
          <div className="w-16 h-1.5 bg-current rounded opacity-20"></div>
          <div className="w-12 h-1.5 bg-current rounded opacity-20"></div>
          <div className="w-10 h-1.5 bg-current rounded opacity-50"></div>
        </div>
      );
    case 'avatar':
      return <div className="w-6 h-6 rounded-full bg-current opacity-40"></div>;
    case 'icon':
      return <div className="w-5 h-5 rounded bg-current opacity-40"></div>;
    case 'badge':
      return <div className="w-10 h-4 rounded-full bg-current opacity-30 border border-current"></div>;
    case 'prefix':
      return (
        <div className="flex items-center gap-1">
          <div className="w-4 h-1.5 bg-current rounded opacity-40"></div>
          <div className="w-12 h-2.5 bg-current rounded opacity-80"></div>
        </div>
      );
    case 'suffix':
      return (
        <div className="flex items-center gap-1">
          <div className="w-12 h-2.5 bg-current rounded opacity-80"></div>
          <div className="w-4 h-1.5 bg-current rounded opacity-40"></div>
        </div>
      );
    default:
      return null;
  }
}

export function RoleCombobox({
  value,
  onChange,
  isDarkMode,
}: {
  value: CompositeRole;
  onChange: (v: CompositeRole) => void;
  isDarkMode: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [dropUp, setDropUp] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const handleOpen = () => {
    if (!open && ref.current) {
      const rect = ref.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      setDropUp(spaceBelow < 300); // Trigger drop-up if less than 300px below
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

  const selectedOption = ROLES_OPTIONS.find(r => r.value === value);

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
        aria-label="Select role"
      >
        <span className="truncate">{selectedOption?.label || 'Select role…'}</span>
        <ChevronDown className={`w-3.5 h-3.5 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''} ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`} />
      </button>

      {open && (
        <ul
          role="listbox"
          className={`absolute left-0 right-0 z-50 p-1 overflow-y-auto max-h-64 rounded-xl border shadow-xl
            ${dropUp ? 'bottom-full mb-1.5' : 'top-full mt-1.5'}
            ${isDarkMode ? 'bg-[#0B1E19] border-[#13C296]/20 shadow-black/50' : 'bg-white border-gray-200 shadow-gray-200'}`}
        >
          {ROLES_OPTIONS.map(role => (
            <li
              key={role.value}
              role="option"
              aria-selected={role.value === value}
              onMouseDown={e => { e.preventDefault(); onChange(role.value); setOpen(false); }}
              className={`flex items-start gap-3 p-2 rounded-lg cursor-pointer transition-colors
                ${isDarkMode
                  ? (role.value === value ? 'bg-[#13C296]/20 text-[#13C296]' : 'text-gray-300 hover:bg-white/10')
                  : (role.value === value ? 'bg-[#13C296]/10 text-[#13C296]' : 'text-gray-700 hover:bg-gray-50')}`}
            >
              <div className="mt-1 flex-shrink-0 w-16 h-8 border rounded flex items-center justify-center border-current/20 bg-current/5">
                <RolePreview role={role.value} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-bold flex items-center justify-between">
                  {role.label}
                  {role.value === value && <Check className="w-3.5 h-3.5" aria-hidden="true" />}
                </div>
                <div className={`text-[11px] leading-tight mt-0.5 opacity-70`}>
                  {role.description}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
