// One design sidebar for every Dynamic* view. The view supplies its layout
// registry (arrangement is per-view), an optional preview renderer, and any
// view-specific controls as `extras`; everything else — slot assignment, field
// list, appearance — is shared.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { GripVertical, Info, Layers, Palette, Plus, RotateCcw, Sparkles, Trash2, Type, X } from 'lucide-react';
import { FieldCombobox } from '../DynamicTable/components/FieldCombobox';
import { ColorPickerModal } from '../DynamicTable/components/ColorPickerModal';
import { isFieldColumn } from '../DynamicTable/types';
import type { ColumnConfig } from '../DynamicTable/types';
import type {
  RecordDesignConfig,
  RecordFieldEntry,
  RecordMediaKind,
  RecordSlotAssignment,
  ViewLayoutDefinition,
} from './recordDesign';
import { getIdentityColumnKeys, getRecordIdentity } from './recordIdentity';
import type { RecordAvatarShape } from './RecordAvatar';

const AUTO_KEY = '__auto__';

const MEDIA_KINDS: { value: RecordMediaKind; label: string }[] = [
  { value: 'avatar', label: 'Avatar' },
  { value: 'image', label: 'Image' },
  { value: 'icon', label: 'Icon' },
  { value: 'none', label: 'None' },
];

const MEDIA_SHAPES: { value: RecordAvatarShape; label: string }[] = [
  { value: 'circle', label: 'Circle' },
  { value: 'rounded', label: 'Rounded' },
  { value: 'square', label: 'Square' },
];

export interface RecordDesignSidebarProps<TLayout extends string> {
  isDarkMode: boolean;
  columns: ColumnConfig[];
  design: RecordDesignConfig<TLayout>;
  onChange: (patch: Partial<RecordDesignConfig<TLayout>>) => void;
  onReset: () => void;
  onClose: () => void;
  layouts: Record<TLayout, ViewLayoutDefinition>;
  /** Live preview rendered outside the sidebar (main canvas). */
  preview?: ReactNode;
  /**
   * `row` — wide frame for List-style previews (default).
   * `card` — compact frame matching Kanban/Card item width.
   */
  previewVariant?: 'row' | 'card';
  /** View-specific controls (Kanban group-by, Calendar date field). */
  extras?: ReactNode;
  title?: string;
}

function LayoutSketch({
  layoutKey,
  arrangement,
  active,
  isDarkMode,
}: {
  layoutKey: string;
  arrangement?: string;
  active: boolean;
  isDarkMode: boolean;
}) {
  const ink = active
    ? 'bg-[#13C296]/50'
    : isDarkMode
      ? 'bg-gray-600'
      : 'bg-gray-300';
  const soft = active
    ? 'bg-[#13C296]/22'
    : isDarkMode
      ? 'bg-gray-700/80'
      : 'bg-gray-200';

  const key = layoutKey.toLowerCase();

  if (arrangement === 'stacked' || key === 'gallery') {
    return (
      <div className="flex h-11 w-full flex-col items-center justify-center gap-1 px-2">
        <div className={`h-4 w-4 rounded-full ${soft}`} />
        <div className={`h-1 w-8 rounded-full ${ink}`} />
        <div className={`h-1 w-5 rounded-full ${soft}`} />
      </div>
    );
  }

  if (arrangement === 'cover' || key === 'cover') {
    return (
      <div className="flex h-11 w-full flex-col overflow-hidden rounded-sm">
        <div className={`h-[18px] w-full ${soft}`} />
        <div className="flex flex-1 flex-col justify-center gap-1 px-1.5 py-1">
          <div className={`h-1 w-3/4 rounded-full ${ink}`} />
          <div className={`h-1 w-1/2 rounded-full ${soft}`} />
        </div>
      </div>
    );
  }

  // List rows (inline) — never match by name alone; Kanban/Card also use "comfortable".
  if (arrangement === 'inline') {
    if (key === 'compact') {
      return (
        <div className="flex h-11 w-full flex-col justify-center gap-1.5 px-2">
          <div className="flex items-center gap-1.5">
            <div className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${soft}`} />
            <div className={`h-1 flex-1 rounded-full ${ink}`} />
          </div>
          <div className="flex items-center gap-1.5">
            <div className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${soft}`} />
            <div className={`h-1 flex-1 rounded-full ${soft}`} />
          </div>
        </div>
      );
    }
    return (
      <div className="flex h-11 w-full items-center gap-1.5 px-2">
        <div className={`h-4 w-4 flex-shrink-0 rounded-full ${soft}`} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className={`h-1.5 w-full rounded-full ${ink}`} />
          <div className={`h-1 w-3/5 rounded-full ${soft}`} />
        </div>
        <div className={`h-2 w-5 flex-shrink-0 rounded-sm ${soft}`} />
      </div>
    );
  }

  // Card / Kanban header cards
  if (arrangement === 'header') {
    if (key === 'compact') {
      return (
        <div className="flex h-11 w-full items-center gap-1.5 px-2">
          <div className={`h-3.5 w-3.5 flex-shrink-0 rounded-full ${soft}`} />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className={`h-1 w-full rounded-full ${ink}`} />
            <div className={`h-1 w-2/3 rounded-full ${soft}`} />
          </div>
        </div>
      );
    }
    if (key === 'comfortable') {
      return (
        <div className="flex h-11 w-full flex-col justify-center gap-1 px-2 py-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <div className={`h-3.5 w-3.5 flex-shrink-0 rounded-full ${soft}`} />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <div className={`h-1 w-full rounded-full ${ink}`} />
              <div className={`h-1 w-1/2 rounded-full ${soft}`} />
            </div>
          </div>
          <div className={`mx-0.5 h-px w-full ${soft}`} />
          <div className="flex flex-col gap-0.5">
            <div className={`h-1 w-full rounded-full ${soft}`} />
            <div className={`h-1 w-3/4 rounded-full ${soft}`} />
          </div>
        </div>
      );
    }
    // detailed — labeled field grid
    return (
      <div className="flex h-11 w-full items-start gap-1.5 px-2 py-1.5">
        <div className={`mt-0.5 h-4 w-4 flex-shrink-0 rounded-full ${soft}`} />
        <div className="flex min-w-0 flex-1 flex-col gap-1 pt-0.5">
          <div className={`h-1 w-full rounded-full ${ink}`} />
          <div className={`h-1 w-2/3 rounded-full ${soft}`} />
          <div className="mt-0.5 grid grid-cols-2 gap-1">
            <div className={`h-1 rounded-full ${soft}`} />
            <div className={`h-1 rounded-full ${soft}`} />
          </div>
        </div>
      </div>
    );
  }

  // Fallback card
  return (
    <div className="flex h-11 w-full items-start gap-1.5 px-2 py-1.5">
      <div className={`mt-0.5 h-4 w-4 flex-shrink-0 rounded-full ${soft}`} />
      <div className="flex min-w-0 flex-1 flex-col gap-1 pt-0.5">
        <div className={`h-1 w-full rounded-full ${ink}`} />
        <div className={`h-1 w-2/3 rounded-full ${soft}`} />
        <div className="mt-0.5 grid grid-cols-2 gap-1">
          <div className={`h-1 rounded-full ${soft}`} />
          <div className={`h-1 rounded-full ${soft}`} />
        </div>
      </div>
    </div>
  );
}

function layoutArrangementOf(def: ViewLayoutDefinition): string | undefined {
  return 'arrangement' in def ? String((def as { arrangement?: string }).arrangement) : undefined;
}

export function DesignSectionLabel({
  icon: Icon,
  children,
  isDarkMode,
  info,
}: {
  icon: React.ElementType;
  children: ReactNode;
  isDarkMode: boolean;
  info?: string;
}) {
  return (
    <div
      className={`mb-3 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}
    >
      <Icon className="h-3.5 w-3.5 text-[#13C296]" />
      <span>{children}</span>
      {info ? <InfoTip text={info} isDarkMode={isDarkMode} /> : null}
    </div>
  );
}

function SectionLabel({
  icon,
  children,
  isDarkMode,
  info,
}: {
  icon: React.ElementType;
  children: ReactNode;
  isDarkMode: boolean;
  info?: string;
}) {
  return (
    <DesignSectionLabel icon={icon} isDarkMode={isDarkMode} info={info}>
      {children}
    </DesignSectionLabel>
  );
}

/** Hover/click info — portals so overflow parents never clip; short aria-label avoids native double tips. */
export function InfoTip({ text, isDarkMode }: { text: string; isDarkMode: boolean }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) {
      setPos(null);
      return;
    }
    const update = () => {
      const r = triggerRef.current!.getBoundingClientRect();
      setPos({ top: r.top - 8, left: r.left + r.width / 2 });
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open]);

  return (
    <span
      ref={triggerRef}
      className="relative inline-flex flex-shrink-0"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <span
        role="button"
        tabIndex={0}
        aria-label="More info"
        aria-expanded={open}
        onClick={e => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(o => !o);
        }}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            setOpen(o => !o);
          }
        }}
        className={`flex h-4 w-4 cursor-pointer items-center justify-center rounded-full transition-colors ${
          open
            ? 'text-[#13C296] bg-[#13C296]/15'
            : isDarkMode
              ? 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
              : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
        }`}
      >
        <Info className="h-3 w-3" strokeWidth={2.25} aria-hidden />
      </span>
      {open &&
        pos &&
        createPortal(
          <span
            role="tooltip"
            style={{ top: pos.top, left: pos.left }}
            className={`fixed z-[9999] w-max max-w-[220px] -translate-x-1/2 -translate-y-full rounded-lg px-2.5 py-1.5 text-[11px] font-medium leading-snug shadow-lg border pointer-events-none ${
              isDarkMode
                ? 'bg-gray-900 text-gray-200 border-gray-700'
                : 'bg-white text-gray-700 border-gray-200'
            }`}
          >
            {text}
          </span>,
          document.body,
        )}
    </span>
  );
}

/** Label + info icon inline (same placement everywhere). Description is tooltip-only. */
export function LabelWithInfo({
  label,
  info,
  isDarkMode,
  className,
  labelClassName,
}: {
  label: string;
  info?: string;
  isDarkMode: boolean;
  className?: string;
  labelClassName?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-1 min-w-0 ${className ?? ''}`}>
      <span
        className={
          labelClassName ??
          `text-[12px] font-semibold truncate ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`
        }
      >
        {label}
      </span>
      {info ? <InfoTip text={info} isDarkMode={isDarkMode} /> : null}
    </span>
  );
}

/**
 * Settings row: label left, info tip + trailing control right.
 * Use for toggles/sliders so the tip doesn’t crowd the label.
 */
export function SettingRow({
  label,
  info,
  isDarkMode,
  trailing,
  children,
  className,
}: {
  label: string;
  info?: string;
  isDarkMode: boolean;
  trailing?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="flex min-h-[28px] items-center justify-between gap-2">
        <span
          className={`min-w-0 truncate text-[12px] font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}
        >
          {label}
        </span>
        <div className="flex flex-shrink-0 items-center gap-1.5">
          {info ? <InfoTip text={info} isDarkMode={isDarkMode} /> : null}
          {trailing}
        </div>
      </div>
      {children ? <div className="mt-1.5">{children}</div> : null}
    </div>
  );
}

/** On/Off chip — same style as Feature Builder. */
export function SettingToggle({
  active,
  onClick,
  isDarkMode,
}: {
  active: boolean;
  onClick: () => void;
  isDarkMode: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider transition-colors ${
        active
          ? 'bg-[#13C296]/20 text-[#0f9f7a]'
          : isDarkMode
            ? 'bg-gray-700 text-gray-200'
            : 'bg-slate-200 text-slate-700 border border-slate-300/70'
      }`}
    >
      {active ? 'ON' : 'OFF'}
    </button>
  );
}

function PillToggle({
  active,
  onClick,
  isDarkMode,
  children,
}: {
  active: boolean;
  onClick: () => void;
  isDarkMode: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-[11px] font-medium px-2.5 py-1 rounded-lg transition-colors flex-shrink-0 ${
        active
          ? isDarkMode
            ? 'bg-[#13C296]/15 text-[#13C296]'
            : 'bg-[#13C296]/10 text-[#0f9f7a]'
          : isDarkMode
            ? 'bg-transparent text-gray-500 hover:bg-white/5 hover:text-gray-300'
            : 'bg-transparent text-gray-500 hover:bg-gray-100 hover:text-gray-700'
      }`}
    >
      {children}
    </button>
  );
}

function SlotLabel({ children, isDarkMode }: { children: ReactNode; isDarkMode: boolean }) {
  return (
    <span
      className={`text-[12px] font-semibold tracking-tight ${
        isDarkMode ? 'text-gray-200' : 'text-gray-800'
      }`}
    >
      {children}
    </span>
  );
}

/** Teal fill + soft gray track — avoids the harsh native black leftover track. */
export function SoftRangeSlider({
  isDarkMode,
  min,
  max,
  value,
  onChange,
  className = 'flex-1',
}: {
  isDarkMode: boolean;
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
  className?: string;
}) {
  const pct = max === min ? 0 : ((value - min) / (max - min)) * 100;
  const trackRest = isDarkMode ? '#374151' : '#e5e7eb';

  return (
    <input
      type="range"
      min={min}
      max={max}
      value={value}
      onChange={e => onChange(Number(e.target.value))}
      style={{ background: `linear-gradient(to right, #13C296 ${pct}%, ${trackRest} ${pct}%)` }}
      className={`${className} cursor-pointer appearance-none h-1.5 rounded-full outline-none
        [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5
        [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#13C296]
        [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:shadow-sm
        [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:rounded-full
        [&::-moz-range-thumb]:bg-[#13C296] [&::-moz-range-thumb]:border-0 [&::-moz-range-track]:bg-transparent`}
    />
  );
}

/** Field picker with an explicit "Auto" entry standing for `fieldKey: undefined`. */
function SlotFieldPicker({
  label,
  slot,
  fields,
  isDarkMode,
  onChange,
  canHide = true,
}: {
  label: string;
  slot: RecordSlotAssignment;
  fields: ColumnConfig[];
  isDarkMode: boolean;
  onChange: (next: RecordSlotAssignment) => void;
  canHide?: boolean;
}) {
  const options: ColumnConfig[] = [
    { key: AUTO_KEY, label: 'Auto (detected)', dataType: 'text' } as ColumnConfig,
    ...fields,
  ];
  const isAuto = !slot.fieldKey;

  return (
    <div className="mb-2.5">
      <div className="flex items-center justify-between mb-1.5">
        <SlotLabel isDarkMode={isDarkMode}>{label}</SlotLabel>
        {canHide && (
          <PillToggle
            active={slot.show}
            isDarkMode={isDarkMode}
            onClick={() => onChange({ ...slot, show: !slot.show })}
          >
            {slot.show ? 'Shown' : 'Hidden'}
          </PillToggle>
        )}
      </div>
      <FieldCombobox
        value={slot.fieldKey ?? AUTO_KEY}
        fields={options}
        isDarkMode={isDarkMode}
        dimValue={isAuto}
        onChange={key => onChange({ ...slot, fieldKey: key === AUTO_KEY ? undefined : key })}
      />
    </div>
  );
}

export function RecordDesignSidebar<TLayout extends string>({
  isDarkMode,
  columns,
  design,
  onChange,
  onReset,
  onClose,
  layouts,
  preview,
  previewVariant = 'row',
  extras,
  title = 'Design',
}: RecordDesignSidebarProps<TLayout>) {
  const [isAnimatingIn, setIsAnimatingIn] = useState(false);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [draggedKey, setDraggedKey] = useState<string | null>(null);

  useEffect(() => {
    requestAnimationFrame(() => setIsAnimatingIn(true));
  }, []);

  const fieldColumns = columns.filter(isFieldColumn).filter(c => c.visible !== false);
  const layoutKeys = Object.keys(layouts) as TLayout[];
  const activeLayout = layouts[design.layout] ?? layouts[layoutKeys[0]];

  // Persisted configs can carry a layout key from another view or an older
  // registry — snap back so slot controls never read undefined.
  useEffect(() => {
    if (layoutKeys.length > 0 && !layouts[design.layout]) {
      onChange({ layout: layoutKeys[0] });
    }
    // layoutKeys derived from `layouts`; listing both would churn every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- layoutKeys[0] is enough with layouts
  }, [design.layout, layouts, onChange]);

  // `null` fields means "auto"; materialise the current auto result so the user
  // can start editing from what they are already looking at.
  const explicitFields: RecordFieldEntry[] = design.fields ?? [];

  const setFields = (next: RecordFieldEntry[] | null) => onChange({ fields: next });

  const handleDropOn = (targetKey: string) => {
    if (!draggedKey || draggedKey === targetKey) return;
    const list = [...explicitFields];
    const from = list.findIndex(f => f.fieldKey === draggedKey);
    const to = list.findIndex(f => f.fieldKey === targetKey);
    if (from < 0 || to < 0) return;
    const [moved] = list.splice(from, 1);
    list.splice(to, 0, moved);
    setFields(list);
    setDraggedKey(null);
  };

  const unusedFields = fieldColumns.filter(c => !explicitFields.some(f => f.fieldKey === c.key));

  const panelBg = isDarkMode ? 'bg-[#0B1E19] border-gray-800' : 'bg-white border-gray-200';
  const cardBg = isDarkMode ? 'bg-[#0e1a17]/60 border-gray-800' : 'bg-gray-50/70 border-gray-200';

  if (!activeLayout) return null;

  return (
    <>
      <div
        className={`fixed inset-0 z-[9995] bg-black/30 transition-opacity ${isAnimatingIn ? 'opacity-100' : 'opacity-0'}`}
        onClick={() => {
          if (colorPickerOpen) return;
          onClose();
        }}
      />

      {/* Desktop: live preview on the main canvas beside the panel */}
      {preview && (
        <div
          className={`hidden md:flex fixed inset-0 z-[9995] items-center justify-center pointer-events-none pr-[360px] transition-opacity ${isAnimatingIn ? 'opacity-100' : 'opacity-0'}`}
        >
          <div
            className={`pointer-events-auto mx-6 rounded-2xl border p-4 shadow-2xl ${
              previewVariant === 'card' ? 'w-auto max-w-sm' : 'w-full max-w-2xl'
            } ${isDarkMode ? 'bg-[#0B1E19] border-gray-800 shadow-black/60' : 'bg-white border-gray-200 shadow-xl'}`}
            onClick={e => e.stopPropagation()}
          >
            <p
              className={`mb-3 text-[11px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}
            >
              Live preview
            </p>
            {previewVariant === 'card' ? (
              <div className="w-full">{preview}</div>
            ) : (
              <div className="overflow-x-auto custom-scrollbar">
                <div className="w-max max-w-none min-w-full">{preview}</div>
              </div>
            )}
          </div>
        </div>
      )}

      <div
        className={`fixed right-0 top-0 bottom-0 z-[9996] w-full sm:w-[360px] sm:max-w-[92vw] border-l flex flex-col transition-transform duration-200 ${panelBg} ${isAnimatingIn ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div
          className={`flex items-center justify-between px-4 py-3 border-b flex-shrink-0 ${isDarkMode ? 'border-gray-800' : 'border-gray-100'}`}
        >
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#13C296]" />
            <h3 className={`text-[14px] font-bold ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>
              {title}
            </h3>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onReset}
              title="Reset to defaults"
              className={`p-1.5 rounded-lg transition-colors ${isDarkMode ? 'text-gray-400 hover:bg-white/10' : 'text-gray-500 hover:bg-gray-100'}`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className={`p-1.5 rounded-lg transition-colors ${isDarkMode ? 'text-gray-400 hover:bg-white/10' : 'text-gray-500 hover:bg-gray-100'}`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
          {/* Mobile: preview lives inside the panel so it isn’t crushed beside it */}
          {preview && (
            <div className="mb-5 md:hidden">
              <SectionLabel icon={Sparkles} isDarkMode={isDarkMode}>
                Preview
              </SectionLabel>
              <div className={`rounded-xl border overflow-x-auto custom-scrollbar ${cardBg}`}>
                <div className="p-3 w-max max-w-none">{preview}</div>
              </div>
            </div>
          )}

          <div className="mb-5" data-tour-id="record-design-layout">
            <SectionLabel
              icon={Layers}
              isDarkMode={isDarkMode}
              info={activeLayout.description || undefined}
            >
              Layout
            </SectionLabel>
            <div className="grid grid-cols-2 gap-2">
              {layoutKeys.map(key => {
                const def = layouts[key];
                const active = design.layout === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => onChange({ layout: key })}
                    className={`flex flex-col rounded-xl border text-left transition-all ${
                      active
                        ? isDarkMode
                          ? 'border-[#13C296]/55 bg-[#13C296]/10 ring-1 ring-[#13C296]/25'
                          : 'border-[#13C296]/45 bg-[#13C296]/10 ring-1 ring-[#13C296]/20'
                        : isDarkMode
                          ? 'border-white/[0.06] bg-white/[0.02] hover:border-white/10 hover:bg-white/[0.04]'
                          : 'border-gray-200/80 bg-gray-50/50 hover:border-gray-300 hover:bg-white'
                    }`}
                  >
                    <div
                      className={`overflow-hidden rounded-t-[11px] border-b ${
                        active
                          ? isDarkMode
                            ? 'border-[#13C296]/20'
                            : 'border-[#13C296]/15'
                          : isDarkMode
                            ? 'border-white/[0.04]'
                            : 'border-gray-100'
                      }`}
                    >
                      <LayoutSketch
                        layoutKey={String(key)}
                        arrangement={layoutArrangementOf(def)}
                        active={active}
                        isDarkMode={isDarkMode}
                      />
                    </div>
                    <div className="px-2 py-1.5">
                      <span
                        className={`block truncate text-[11.5px] font-semibold tracking-tight ${
                          active
                            ? isDarkMode
                              ? 'text-gray-100'
                              : 'text-gray-800'
                            : isDarkMode
                              ? 'text-gray-400'
                              : 'text-gray-600'
                        }`}
                      >
                        {def.label}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {extras && <div className="mb-5">{extras}</div>}

          <div className="mb-5" data-tour-id="record-design-slots">
            <SectionLabel icon={Type} isDarkMode={isDarkMode}>
              Slots
            </SectionLabel>

            <div className="mb-2.5">
              <span
                className={`text-[12px] font-semibold tracking-tight block mb-1.5 ${
                  isDarkMode ? 'text-gray-200' : 'text-gray-800'
                }`}
              >
                Media
              </span>
              <div className={`flex flex-wrap items-center gap-0.5 mb-1.5 p-0.5 rounded-xl ${isDarkMode ? 'bg-white/[0.03]' : 'bg-gray-50'}`}>
                {MEDIA_KINDS.map(k => (
                  <PillToggle
                    key={k.value}
                    active={design.media.kind === k.value}
                    isDarkMode={isDarkMode}
                    onClick={() => onChange({ media: { ...design.media, kind: k.value } })}
                  >
                    {k.label}
                  </PillToggle>
                ))}
              </div>
              {design.media.kind !== 'none' && (
                <>
                  <div className={`flex flex-wrap items-center gap-0.5 mb-1.5 p-0.5 rounded-xl ${isDarkMode ? 'bg-white/[0.03]' : 'bg-gray-50'}`}>
                    {MEDIA_SHAPES.map(s => (
                      <PillToggle
                        key={s.value}
                        active={design.media.shape === s.value}
                        isDarkMode={isDarkMode}
                        onClick={() => onChange({ media: { ...design.media, shape: s.value } })}
                      >
                        {s.label}
                      </PillToggle>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={`text-[11px] flex-shrink-0 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                      Size {design.media.size ?? activeLayout.mediaSize}px
                    </span>
                    <SoftRangeSlider
                      isDarkMode={isDarkMode}
                      min={16}
                      max={120}
                      value={design.media.size ?? activeLayout.mediaSize}
                      onChange={size => onChange({ media: { ...design.media, size } })}
                    />
                  </div>
                  <FieldCombobox
                    value={design.media.fieldKey ?? AUTO_KEY}
                    fields={[{ key: AUTO_KEY, label: 'Auto (detected)', dataType: 'text' } as ColumnConfig, ...fieldColumns]}
                    isDarkMode={isDarkMode}
                    dimValue={!design.media.fieldKey}
                    onChange={key =>
                      onChange({ media: { ...design.media, fieldKey: key === AUTO_KEY ? undefined : key } })
                    }
                  />
                </>
              )}
            </div>

            <SlotFieldPicker
              label="Title"
              slot={design.title}
              fields={fieldColumns}
              isDarkMode={isDarkMode}
              canHide={false}
              onChange={next => onChange({ title: next })}
            />
            <SlotFieldPicker
              label="Subtitle"
              slot={design.subtitle}
              fields={fieldColumns}
              isDarkMode={isDarkMode}
              onChange={next => onChange({ subtitle: next })}
            />
            <SlotFieldPicker
              label="Badge"
              slot={design.badge}
              fields={fieldColumns}
              isDarkMode={isDarkMode}
              onChange={next => onChange({ badge: next })}
            />
            <SlotFieldPicker
              label="Status"
              slot={design.status}
              fields={fieldColumns}
              isDarkMode={isDarkMode}
              onChange={next => onChange({ status: next })}
            />
          </div>

          <div className="mb-5">
            <SectionLabel icon={Layers} isDarkMode={isDarkMode}>
              Displayed fields
            </SectionLabel>

            <div className={`mb-2 rounded-xl border px-2.5 py-2 ${cardBg}`}>
              <SettingRow
                label="Automatic"
                info="Pick fields for me based on the layout"
                isDarkMode={isDarkMode}
                trailing={
                  <SettingToggle
                    active={design.fields === null}
                    isDarkMode={isDarkMode}
                    onClick={() =>
                      setFields(
                        design.fields === null
                          ? (() => {
                              const skip = design.excludeIdentityFields
                                ? getIdentityColumnKeys(
                                    getRecordIdentity({ rowId: '__preview__', values: {} }, columns),
                                  )
                                : new Set<string>();
                              return fieldColumns
                                .filter(c => !skip.has(c.key))
                                .slice(0, activeLayout.autoFieldCap)
                                .map(c => ({
                                  fieldKey: c.key,
                                  showLabel: activeLayout.showFieldLabels,
                                  span: 1 as const,
                                }));
                            })()
                          : null,
                      )
                    }
                  />
                }
              />
            </div>

            {design.fields === null ? (
              <div className={`rounded-xl border px-2.5 py-2 ${cardBg}`}>
                <SettingRow
                  label="Skip fields already shown"
                  info="Avoids repeating the title or subtitle in the field list"
                  isDarkMode={isDarkMode}
                  trailing={
                    <SettingToggle
                      active={design.excludeIdentityFields}
                      isDarkMode={isDarkMode}
                      onClick={() => onChange({ excludeIdentityFields: !design.excludeIdentityFields })}
                    />
                  }
                />
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-1.5">
                  {explicitFields.map(entry => {
                    const col = fieldColumns.find(c => c.key === entry.fieldKey);
                    if (!col) return null;
                    return (
                      <div
                        key={entry.fieldKey}
                        draggable
                        onDragStart={() => setDraggedKey(entry.fieldKey)}
                        onDragEnd={() => setDraggedKey(null)}
                        onDragOver={e => e.preventDefault()}
                        onDrop={() => handleDropOn(entry.fieldKey)}
                        className={`flex items-center gap-1.5 px-2 py-1.5 rounded-xl border ${cardBg} ${draggedKey === entry.fieldKey ? 'opacity-40' : ''}`}
                      >
                        <GripVertical
                          className={`w-3.5 h-3.5 flex-shrink-0 cursor-grab ${isDarkMode ? 'text-gray-600' : 'text-gray-400'}`}
                        />
                        <span
                          className={`text-[12px] font-medium truncate flex-1 ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}
                        >
                          {col.label}
                        </span>
                        <PillToggle
                          active={entry.showLabel}
                          isDarkMode={isDarkMode}
                          onClick={() =>
                            setFields(
                              explicitFields.map(f =>
                                f.fieldKey === entry.fieldKey ? { ...f, showLabel: !f.showLabel } : f,
                              ),
                            )
                          }
                        >
                          Label
                        </PillToggle>
                        <PillToggle
                          active={entry.span === 2}
                          isDarkMode={isDarkMode}
                          onClick={() =>
                            setFields(
                              explicitFields.map(f =>
                                f.fieldKey === entry.fieldKey ? { ...f, span: f.span === 2 ? 1 : 2 } : f,
                              ),
                            )
                          }
                        >
                          Wide
                        </PillToggle>
                        <button
                          type="button"
                          onClick={() => setFields(explicitFields.filter(f => f.fieldKey !== entry.fieldKey))}
                          className={`p-1 rounded-md flex-shrink-0 transition-colors ${isDarkMode ? 'text-gray-500 hover:text-rose-400 hover:bg-white/10' : 'text-gray-400 hover:text-rose-500 hover:bg-gray-100'}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>

                {unusedFields.length > 0 && (
                  <div className="mt-2">
                    <FieldCombobox
                      value=""
                      fields={unusedFields}
                      isDarkMode={isDarkMode}
                      onChange={key =>
                        setFields([
                          ...explicitFields,
                          { fieldKey: key, showLabel: activeLayout.showFieldLabels, span: 1 },
                        ])
                      }
                    />
                    <p className={`mt-1 flex items-center gap-1 text-[10px] ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                      <Plus className="w-3 h-3" /> Pick a field to add it
                    </p>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="mb-2">
            <SectionLabel icon={Palette} isDarkMode={isDarkMode}>
              Appearance
            </SectionLabel>

            <div className={`flex items-center justify-between mb-2 px-2.5 py-2 rounded-xl border ${cardBg}`}>
              <span className={`text-[12px] font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                Accent colour
              </span>
              <button
                type="button"
                onClick={() => setColorPickerOpen(true)}
                className="w-6 h-6 rounded-lg border border-white/20 shadow-xs flex-shrink-0"
                style={{ backgroundColor: design.accentColor }}
                aria-label="Choose accent colour"
              />
            </div>

            <div className={`mb-2 rounded-xl border px-2.5 py-2 ${cardBg}`}>
              <SettingRow
                label="Dividers"
                info="Show lines between field groups on the record"
                isDarkMode={isDarkMode}
                trailing={
                  <SettingToggle
                    active={design.showDividers}
                    isDarkMode={isDarkMode}
                    onClick={() => onChange({ showDividers: !design.showDividers })}
                  />
                }
              />
            </div>

            <div className={`rounded-xl border px-2.5 py-2 ${cardBg}`}>
              <SettingRow
                label="Corner radius"
                isDarkMode={isDarkMode}
                trailing={
                  <span className={`text-[11px] tabular-nums ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                    {design.cornerRadius}px
                  </span>
                }
              >
                <SoftRangeSlider
                  isDarkMode={isDarkMode}
                  min={0}
                  max={28}
                  value={design.cornerRadius}
                  onChange={cornerRadius => onChange({ cornerRadius })}
                  className="w-full"
                />
              </SettingRow>
            </div>
          </div>
        </div>
      </div>

      <ColorPickerModal
        isOpen={colorPickerOpen}
        currentColor={design.accentColor}
        isDarkMode={isDarkMode}
        onClose={() => setColorPickerOpen(false)}
        onSelectColor={color => onChange({ accentColor: color })}
      />
    </>
  );
}
