import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  HOUR12_OPTIONS,
  buildMinuteOptions,
  from12HourParts,
  to12HourParts,
  toTimeValue,
  type Meridiem,
} from './dateTimeUtils';

/** Compact drum — 3 rows: prev · selected · next */
export const ROW_H = 32;
export const VISIBLE_ROWS = 3;
export const PAD_ROWS = 1;
export const PICKER_H = ROW_H * VISIBLE_ROWS;

interface TimeColumnPickerProps {
  value: string;
  onChange: (time24: string) => void;
  isDarkMode: boolean;
  minuteStep?: number;
  showTitle?: boolean;
}

interface WheelColumnProps<T extends string | number> {
  items: T[];
  selected: T;
  onSelect: (item: T) => void;
  formatLabel: (item: T) => string;
  isDarkMode: boolean;
  align?: 'center' | 'left' | 'right';
}

function WheelColumn<T extends string | number>({
  items,
  selected,
  onSelect,
  formatLabel,
  isDarkMode,
  align = 'center',
}: WheelColumnProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);
  const scrollTimer = useRef<number | undefined>(undefined);
  const dragging = useRef(false);

  const alignClass = align === 'left' ? 'justify-start pl-3' : align === 'right' ? 'justify-end pr-2' : 'justify-center';
  const baseText = isDarkMode ? 'text-gray-100' : 'text-gray-900';

  const updateFade = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const center = container.scrollTop + container.clientHeight / 2;
    container.querySelectorAll<HTMLButtonElement>('[data-wheel-item]').forEach(btn => {
      const mid = btn.offsetTop + ROW_H / 2;
      const dist = Math.abs(mid - center) / ROW_H;
      // Keep all rows readable — only slightly fade neighbours
      const opacity = dist < 0.4 ? 1 : dist < 1.1 ? 0.55 : 0.35;
      btn.style.opacity = String(opacity);
      btn.style.fontWeight = dist < 0.4 ? '600' : '400';
    });
  }, []);

  const scrollToSelected = useCallback((smooth = false) => {
    const el = selectedRef.current;
    const container = containerRef.current;
    if (!el || !container) return;
    const top = el.offsetTop - (container.clientHeight - ROW_H) / 2;
    container.scrollTo({ top: Math.max(0, top), behavior: smooth ? 'smooth' : 'auto' });
    requestAnimationFrame(updateFade);
  }, [updateFade]);

  useEffect(() => {
    requestAnimationFrame(() => {
      scrollToSelected(false);
      requestAnimationFrame(updateFade);
    });
  }, [selected, scrollToSelected, updateFade]);

  const pickNearest = (): T | null => {
    const container = containerRef.current;
    if (!container) return null;
    const center = container.scrollTop + container.clientHeight / 2;
    let bestDist = Infinity;
    let best: T | null = null;
    container.querySelectorAll<HTMLButtonElement>('[data-wheel-item]').forEach(btn => {
      const idx = Number(btn.dataset.index);
      const item = items[idx];
      if (item === undefined) return;
      const dist = Math.abs(btn.offsetTop + ROW_H / 2 - center);
      if (dist < bestDist) {
        bestDist = dist;
        best = item;
      }
    });
    return best;
  };

  const onScrollEnd = () => {
    if (dragging.current) return;
    const nearest = pickNearest();
    if (nearest !== null && nearest !== selected) onSelect(nearest);
    else scrollToSelected(true);
  };

  return (
    <div
      ref={containerRef}
      className="h-full overflow-y-auto overscroll-contain snap-y snap-mandatory [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      onWheel={e => e.stopPropagation()}
      onTouchMove={e => e.stopPropagation()}
      onScroll={() => {
        updateFade();
        window.clearTimeout(scrollTimer.current);
        scrollTimer.current = window.setTimeout(onScrollEnd, 100);
      }}
      onPointerDown={() => { dragging.current = true; }}
      onPointerUp={() => { dragging.current = false; onScrollEnd(); }}
    >
      <div style={{ paddingTop: ROW_H * PAD_ROWS, paddingBottom: ROW_H * PAD_ROWS }}>
        {items.map((item, index) => (
          <button
            key={`${String(item)}_${index}`}
            ref={item === selected ? selectedRef : undefined}
            type="button"
            data-wheel-item
            data-index={index}
            style={{ height: ROW_H, opacity: item === selected ? 1 : 0.55 }}
            onMouseDown={e => { e.preventDefault(); e.stopPropagation(); onSelect(item); }}
            className={`w-full flex items-center ${alignClass} snap-center tabular-nums select-none text-[16px] leading-none ${baseText}`}
          >
            {formatLabel(item)}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Drum time picker — 3 visible rows, shared pill.
 */
export function TimeColumnPicker({
  value,
  onChange,
  isDarkMode,
  minuteStep = 1,
  showTitle = true,
}: TimeColumnPickerProps) {
  const time24 = toTimeValue(value) || '00:00';
  const { hour12, minute, period } = to12HourParts(time24);
  const minuteOptions = useMemo(
    () => buildMinuteOptions(minuteStep, minute),
    [minuteStep, minute],
  );

  const setParts = (h12: number, min: string, mer: Meridiem) => {
    onChange(from12HourParts(h12, min, mer));
  };

  return (
    <div className="select-none" onWheel={e => e.stopPropagation()}>
      {showTitle && (
        <p className={`text-center text-[13px] font-semibold tracking-tight mb-2 ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>
          Time
        </p>
      )}

      <div className="relative overflow-hidden rounded-xl" style={{ height: PICKER_H }}>
        {/* Selection pill */}
        <div
          className={`pointer-events-none absolute inset-x-2 top-1/2 -translate-y-1/2 rounded-full z-0
            ${isDarkMode ? 'bg-gray-800' : 'bg-gray-100'}`}
          style={{ height: ROW_H + 2 }}
        />

        <div
          className="relative z-10 grid h-full"
          style={{ gridTemplateColumns: 'minmax(0,1fr) 12px minmax(0,1fr) 44px' }}
        >
          <WheelColumn
            items={[...HOUR12_OPTIONS]}
            selected={hour12}
            onSelect={h => setParts(h, minute, period)}
            formatLabel={h => String(h)}
            isDarkMode={isDarkMode}
            align="right"
          />

          <div className={`flex items-center justify-center z-20 pointer-events-none font-semibold text-[16px] leading-none ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>
            :
          </div>

          <WheelColumn
            items={minuteOptions}
            selected={minute}
            onSelect={m => setParts(hour12, m, period)}
            formatLabel={m => m}
            isDarkMode={isDarkMode}
            align="left"
          />

          <WheelColumn
            items={['AM', 'PM'] as Meridiem[]}
            selected={period}
            onSelect={p => setParts(hour12, minute, p)}
            formatLabel={p => p.toLowerCase()}
            isDarkMode={isDarkMode}
            align="center"
          />
        </div>
      </div>
    </div>
  );
}
