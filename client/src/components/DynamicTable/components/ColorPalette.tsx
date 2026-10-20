import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Pipette } from 'lucide-react';

const PRESET_COLORS = [
  '#FEE2E2', '#FECACA', '#FCA5A5', '#EF4444', '#DC2626',
  '#FFEDD5', '#FED7AA', '#FB923C', '#F97316', '#EA580C',
  '#FEF9C3', '#FEF08A', '#FDE047', '#EAB308', '#CA8A04',
  '#DCFCE7', '#BBF7D0', '#86EFAC', '#22C55E', '#16A34A',
  '#CCFBF1', '#99F6E4', '#5EEAD4', '#14B8A6', '#0D9488',
  '#DBEAFE', '#BFDBFE', '#93C5FD', '#3B82F6', '#2563EB',
  '#E0E7FF', '#C7D2FE', '#A5B4FC', '#6366F1', '#4F46E5',
  '#F3E8FF', '#E9D5FF', '#D8B4FE', '#A855F7', '#9333EA',
  '#FCE7F3', '#FBCFE8', '#F9A8D4', '#EC4899', '#DB2777',
  '#FFFFFF', '#F3F4F6', '#D1D5DB', '#6B7280', '#111827',
];

const PANEL_WIDTH = 280;
const PANEL_EST_HEIGHT = 320;

interface ColorPaletteProps {
  value?: string;
  recentColors: string[];
  onSelect: (hex: string) => void;
  onClear?: () => void;
  isDarkMode: boolean;
  label?: string;
  /** Narrow trigger for side-by-side layouts */
  compact?: boolean;
}

export function ColorPalette({
  value,
  recentColors,
  onSelect,
  onClear,
  isDarkMode,
  label,
  compact,
}: ColorPaletteProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const updatePosition = () => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const width = PANEL_WIDTH;
    const height = panelRef.current?.offsetHeight || PANEL_EST_HEIGHT;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < height + 12 && rect.top > spaceBelow;

    let left = rect.left;
    if (left + width > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - width - 8);
    }
    if (left < 8) left = 8;

    const top = openUp
      ? Math.max(8, rect.top - height - 6)
      : Math.min(rect.bottom + 6, window.innerHeight - height - 8);

    setPos({ top, left });
  };

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    updatePosition();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    // Reposition after panel mounts with real height
    requestAnimationFrame(updatePosition);
    const onReposition = () => updatePosition();
    window.addEventListener('resize', onReposition);
    window.addEventListener('scroll', onReposition, true);
    return () => {
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition, true);
    };
  }, [open]);

  const handlePick = (hex: string) => {
    onSelect(hex);
    setOpen(false);
  };

  const panel = open && pos
    ? createPortal(
        <>
          <div className="fixed inset-0 z-[10050]" onClick={() => setOpen(false)} />
          <div
            ref={panelRef}
            className={`fixed z-[10051] p-3 rounded-xl border shadow-xl
              ${isDarkMode ? 'bg-[#0F2A23] border-[#13C296]/20' : 'bg-white border-gray-200'}`}
            style={{ top: pos.top, left: pos.left, width: PANEL_WIDTH }}
          >
            <div className="grid grid-cols-10 gap-1.5 mb-3">
              {PRESET_COLORS.map(hex => (
                <button
                  key={hex}
                  type="button"
                  title={hex}
                  onClick={() => handlePick(hex)}
                  className={`w-full aspect-square rounded-md border transition-transform hover:scale-110
                    ${value?.toLowerCase() === hex.toLowerCase()
                      ? 'ring-2 ring-[#13C296] ring-offset-1'
                      : ''}
                    ${isDarkMode ? 'border-white/10' : 'border-gray-200'}`}
                  style={{ backgroundColor: hex }}
                />
              ))}
            </div>

            {recentColors.length > 0 && (
              <div className="mb-3">
                <div className={`text-[10px] font-bold uppercase tracking-wider mb-1.5 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                  Recent
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {recentColors.map(hex => (
                    <button
                      key={hex}
                      type="button"
                      title={hex}
                      onClick={() => handlePick(hex)}
                      className={`w-6 h-6 rounded-md border transition-transform hover:scale-110
                        ${isDarkMode ? 'border-white/10' : 'border-gray-200'}`}
                      style={{ backgroundColor: hex }}
                    />
                  ))}
                </div>
              </div>
            )}

            {value && onClear && (
              <button
                type="button"
                onClick={() => {
                  onClear();
                  setOpen(false);
                }}
                className={`w-full mb-2 py-1.5 rounded-lg text-[12px] font-medium transition-colors
                  ${isDarkMode ? 'text-gray-400 hover:bg-white/5' : 'text-gray-500 hover:bg-gray-50'}`}
              >
                Clear color
              </button>
            )}
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg border text-[12px] font-medium transition-colors
                ${isDarkMode
                  ? 'border-gray-600 text-gray-300 hover:border-[#13C296] hover:text-[#13C296]'
                  : 'border-gray-300 text-gray-600 hover:border-[#13C296] hover:text-[#13C296]'}`}
            >
              <Pipette className="w-3.5 h-3.5" />
              Custom color
            </button>
            <input
              ref={inputRef}
              type="color"
              value={value && /^#[0-9a-fA-F]{6}$/.test(value) ? value : '#13C296'}
              onChange={e => handlePick(e.target.value)}
              className="sr-only"
              tabIndex={-1}
            />
          </div>
        </>,
        document.body,
      )
    : null;

  return (
    <div className="space-y-1.5 min-w-0">
      {label && (
        <label className={`text-[11px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
          {label}
        </label>
      )}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(v => !v)}
        className={`w-full flex items-center gap-2 rounded-lg border text-left transition-colors
          ${compact ? 'px-2 py-2 gap-1.5' : 'px-3 py-2 gap-2.5'}
          ${isDarkMode ? 'bg-black/20 border-gray-700 hover:border-[#13C296]' : 'bg-white border-gray-300 hover:border-[#13C296]'}`}
      >
        <span
          className={`rounded-md border flex-shrink-0 ${compact ? 'w-5 h-5' : 'w-6 h-6'} ${isDarkMode ? 'border-gray-600' : 'border-gray-300'}`}
          style={{ backgroundColor: value || 'transparent' }}
        />
        <span className={`text-[13px] flex-1 truncate ${value ? (isDarkMode ? 'text-gray-200' : 'text-gray-800') : (isDarkMode ? 'text-gray-500' : 'text-gray-400')}`}>
          {compact ? (value ? value.toUpperCase().slice(0, 7) : '—') : (value || 'None')}
        </span>
        {value && onClear && !compact && (
          <span
            role="button"
            tabIndex={0}
            onClick={e => {
              e.stopPropagation();
              onClear();
            }}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.stopPropagation();
                onClear();
              }
            }}
            className={`text-[11px] font-medium px-1.5 py-0.5 rounded ${isDarkMode ? 'text-gray-400 hover:bg-white/10' : 'text-gray-500 hover:bg-gray-100'}`}
          >
            Clear
          </span>
        )}
      </button>
      {panel}
    </div>
  );
}
