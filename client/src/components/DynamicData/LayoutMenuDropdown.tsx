// Compact layout picker for narrow toolbars (mobile). Desktop keeps the icon strip.
import { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface LayoutMenuOption<T extends string> {
  key: T;
  label: string;
  icon: LucideIcon;
}

interface LayoutMenuDropdownProps<T extends string> {
  isDarkMode: boolean;
  value: T;
  options: LayoutMenuOption<T>[];
  onChange: (key: T) => void;
  /** Visible on small screens only when true (default). */
  mobileOnly?: boolean;
}

export function LayoutMenuDropdown<T extends string>({
  isDarkMode,
  value,
  options,
  onChange,
  mobileOnly = true,
}: LayoutMenuDropdownProps<T>) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const active = options.find(o => o.key === value) ?? options[0];
  const ActiveIcon = active.icon;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const iconBtnCls = `relative flex items-center justify-center w-8 h-8 rounded-lg transition-all active:scale-90 duration-200 flex-shrink-0
    ${
      open
        ? isDarkMode
          ? 'bg-gray-800 text-gray-200'
          : 'bg-gray-100 text-gray-900'
        : isDarkMode
          ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
          : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
    }`;

  return (
    <div
      ref={rootRef}
      className={`relative flex-shrink-0 ${mobileOnly ? 'sm:hidden' : ''}`}
    >
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={active.label}
        title={active.label}
        className={iconBtnCls}
      >
        <ActiveIcon className="w-4 h-4" strokeWidth={2} />
      </button>

      {open && (
        <div
          role="listbox"
          className={`absolute right-0 top-full mt-1.5 z-50 min-w-[168px] max-w-[min(220px,calc(100vw-2rem))] rounded-xl border py-1 shadow-lg ${
            isDarkMode ? 'bg-[#0B1E19] border-gray-800' : 'bg-white border-gray-200'
          }`}
        >
          {options.map(({ key, label, icon: Icon }) => {
            const selected = key === value;
            return (
              <button
                key={key}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  onChange(key);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-[12.5px] font-medium transition-colors ${
                  selected
                    ? isDarkMode
                      ? 'bg-[#13C296]/15 text-[#13C296]'
                      : 'bg-[#13C296]/10 text-[#0f9f7a]'
                    : isDarkMode
                      ? 'text-gray-300 hover:bg-white/5'
                      : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="flex-1 truncate">{label}</span>
                {selected && <Check className="w-3.5 h-3.5 flex-shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
