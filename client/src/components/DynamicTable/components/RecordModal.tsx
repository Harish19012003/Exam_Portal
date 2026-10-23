import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Check, GripHorizontal, Sparkles } from 'lucide-react';
import type { ColumnConfig, DataRow, DataType, FieldColumn } from '../types';
import { isFieldColumn } from '../types';
import { getRecordIdentity } from '../../DynamicData/recordIdentity';
import { getInitials, avatarColor } from '../utils';
import { StatusBadge } from '../renderers';
import { FieldControl } from './RecordEditSidebar';

interface RecordModalProps {
  row: DataRow;
  columns: ColumnConfig[];
  isDarkMode: boolean;
  onSave: (updatedRow: DataRow) => void;
  onClose: () => void;
}

/** Types that always deserve a full-width editor row. */
const FULL_ROW_TYPES = new Set<DataType>(['multiselect', 'tags', 'attachment']);

/** Types whose values are typically long prose / multi-line. */
const LONG_TEXT_LABEL =
  /\b(address|remark|note|notes|description|bio|summary|comment|comments|details|about)\b/i;

const MODAL_MIN_WIDTH = 400;
const MODAL_DEFAULT_WIDTH = 720;
const MODAL_VIEWPORT_MARGIN = 32;
const MOBILE_MAX = 767;

const SECTION_ORDER = ['Profile', 'Contact', 'Location', 'Work', 'Activity', 'Other'] as const;
type SectionName = (typeof SECTION_ORDER)[number];

/** Effective type for layout — formulas follow their result type. */
function effectiveFieldType(col: FieldColumn): DataType {
  if (col.dataType === 'formula') return col.resultType ?? 'text';
  return col.dataType;
}

function fieldLabelBlob(col: FieldColumn): string {
  return `${col.label} ${col.key}`;
}

function isFullRowField(col: FieldColumn): boolean {
  const dt = effectiveFieldType(col);
  if (FULL_ROW_TYPES.has(dt)) return true;
  if (dt === 'text' && LONG_TEXT_LABEL.test(fieldLabelBlob(col))) return true;
  if (col.width != null && col.width >= 280) return true;
  return false;
}

/**
 * Group fields by semantic section using dataType first.
 * Label/key word hints are schema-agnostic fallbacks (not demo field-key lists).
 */
function fieldSection(col: FieldColumn): SectionName {
  const dt = effectiveFieldType(col);
  const blob = fieldLabelBlob(col);

  if (dt === 'image' || dt === 'icon') return 'Profile';
  if (dt === 'email' || dt === 'phone' || dt === 'link') return 'Contact';
  if (dt === 'date' || dt === 'datetime' || dt === 'time') return 'Activity';

  if (
    dt === 'status' ||
    dt === 'currency' ||
    dt === 'number' ||
    dt === 'progress' ||
    dt === 'rating' ||
    dt === 'boolean' ||
    dt === 'checkbox' ||
    dt === 'multiselect' ||
    dt === 'tags' ||
    dt === 'attachment' ||
    dt === 'dropdown' ||
    dt === 'select'
  ) {
    return 'Work';
  }

  if (/\b(country|state|city|address|zip|postal|region|province|location)\b/i.test(blob)) {
    return 'Location';
  }
  if (/\b(name|title|designation|role|avatar|photo|profile|headline)\b/i.test(blob)) {
    return 'Profile';
  }
  if (/\b(email|phone|mobile|tel|website|url|contact)\b/i.test(blob)) {
    return 'Contact';
  }
  if (/\b(login|shift|schedule|last.?seen|activity|timestamp)\b/i.test(blob)) {
    return 'Activity';
  }
  if (/\b(salary|wage|bonus|department|team|experience|remote|verified|status|completion)\b/i.test(blob)) {
    return 'Work';
  }

  return 'Other';
}

function groupFieldsBySection(cols: FieldColumn[]): { section: SectionName; fields: FieldColumn[] }[] {
  const buckets = new Map<SectionName, FieldColumn[]>();
  for (const col of cols) {
    const section = fieldSection(col);
    buckets.set(section, [...(buckets.get(section) ?? []), col]);
  }
  return SECTION_ORDER.filter(s => buckets.has(s)).map(section => ({
    section,
    fields: buckets.get(section)!,
  }));
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= MOBILE_MAX);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= MOBILE_MAX);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return isMobile;
}

function clampWidth(w: number) {
  const max = window.innerWidth - MODAL_VIEWPORT_MARGIN * 2;
  return Math.min(max, Math.max(MODAL_MIN_WIDTH, w));
}

function gridColumnCount(modalWidth: number, isMobile: boolean): number {
  if (isMobile) return 1;
  if (modalWidth >= 960) return 3;
  return 2;
}

function RecordAvatar({ url, name }: { url?: string; name: string }) {
  const bg = avatarColor(name || 'record');
  return (
    <div className="relative flex-shrink-0">
      <div
        className="absolute -inset-0.5 rounded-2xl bg-gradient-to-br from-[#13C296] to-[#0ea5e9] opacity-70 blur-[1px]"
        aria-hidden
      />
      <div
        className="relative w-14 h-14 rounded-2xl overflow-hidden flex items-center justify-center text-white text-base font-bold select-none shadow-lg ring-2 ring-white/80"
        style={{ backgroundColor: bg }}
      >
        {url ? (
          <img src={url} alt={name} loading="lazy" decoding="async" className="w-full h-full object-cover" />
        ) : (
          getInitials(name || '?')
        )}
      </div>
    </div>
  );
}

function ModalFieldCell({
  col,
  value,
  onChange,
  row,
  isDarkMode,
  fullRow,
}: {
  col: FieldColumn;
  value: unknown;
  onChange: (v: unknown) => void;
  row: DataRow;
  isDarkMode: boolean;
  fullRow?: boolean;
}) {
  const labelCls = isDarkMode ? 'text-gray-400' : 'text-gray-500';

  return (
    <div
      className="group min-w-0"
      style={fullRow ? { gridColumn: '1 / -1' } : undefined}
    >
      <label className={`flex items-center gap-1.5 text-[11px] font-semibold mb-1.5 truncate ${labelCls}`}>
        <span className="w-1 h-1 rounded-full bg-[#13C296]/80 opacity-0 group-focus-within:opacity-100 transition-opacity" />
        {col.label}
      </label>
      <div
        className={`rounded-lg transition-shadow group-focus-within:shadow-[0_0_0_3px_rgba(19,194,150,0.12)] ${
          isDarkMode ? 'group-focus-within:bg-[#101f1b]/40' : 'group-focus-within:bg-teal-50/30'
        }`}
      >
        <FieldControl
          col={col}
          value={value}
          onChange={onChange}
          row={row}
          isDarkMode={isDarkMode}
        />
      </div>
    </div>
  );
}

function SectionBlock({
  title,
  fields,
  columnsCount,
  draftValues,
  recordContext,
  isDarkMode,
  onFieldChange,
}: {
  title: SectionName;
  fields: FieldColumn[];
  columnsCount: number;
  draftValues: Record<string, unknown>;
  recordContext: DataRow;
  isDarkMode: boolean;
  onFieldChange: (key: string, value: unknown) => void;
}) {
  const divider = isDarkMode ? 'border-gray-800/70' : 'border-gray-200/80';
  const titleCls = isDarkMode ? 'text-gray-300' : 'text-gray-700';

  return (
    <section className={`pt-5 first:pt-0 border-t first:border-t-0 ${divider}`}>
      <div className="flex items-center gap-2 mb-3">
        <span className="h-px flex-1 bg-gradient-to-r from-[#13C296]/40 to-transparent" />
        <h5 className={`text-[10px] font-bold uppercase tracking-[0.14em] ${titleCls}`}>{title}</h5>
        <span className="h-px flex-1 bg-gradient-to-l from-[#13C296]/40 to-transparent" />
      </div>
      <div
        className="grid gap-x-5 gap-y-4"
        style={{ gridTemplateColumns: `repeat(${columnsCount}, minmax(0, 1fr))` }}
      >
        {fields.map(col => (
          <ModalFieldCell
            key={col.key}
            col={col}
            value={draftValues[col.key]}
            onChange={v => onFieldChange(col.key, v)}
            row={recordContext}
            isDarkMode={isDarkMode}
            fullRow={isFullRowField(col)}
          />
        ))}
      </div>
    </section>
  );
}

export function RecordModal({ row, columns, isDarkMode, onSave, onClose }: RecordModalProps) {
  const [draftValues, setDraftValues] = useState<Record<string, unknown>>({ ...row.values });
  const [isAnimatingIn, setIsAnimatingIn] = useState(false);
  const [modalWidth, setModalWidth] = useState(MODAL_DEFAULT_WIDTH);
  const isMobile = useIsMobile();
  const formRef = useRef<HTMLFormElement>(null);

  const fieldCols = columns.filter((c): c is FieldColumn => isFieldColumn(c) && c.visible !== false);
  const sections = useMemo(() => groupFieldsBySection(fieldCols), [fieldCols]);
  const recordContext: DataRow = { ...row, values: draftValues };
  const identity = getRecordIdentity(recordContext, columns);
  const columnsCount = useMemo(() => gridColumnCount(modalWidth, isMobile), [modalWidth, isMobile]);
  const statusLabel = identity.statusValue || identity.badge;

  useEffect(() => {
    setDraftValues({ ...row.values });
  }, [row]);

  useEffect(() => {
    requestAnimationFrame(() => setIsAnimatingIn(true));
  }, []);

  useEffect(() => {
    if (!isMobile) setModalWidth(prev => clampWidth(prev));
  }, [isMobile]);

  const handleClose = () => {
    setIsAnimatingIn(false);
    setTimeout(onClose, 200);
  };

  const handleFieldChange = (key: string, value: unknown) => {
    setDraftValues(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ ...row, values: draftValues });
    handleClose();
  };

  const startResize = useCallback((e: React.MouseEvent) => {
    if (isMobile) return;
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startW = modalWidth;

    const onMove = (ev: MouseEvent) => {
      setModalWidth(clampWidth(startW + (ev.clientX - startX)));
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [isMobile, modalWidth]);

  const panelBg = isDarkMode
    ? 'bg-[#0e1a17] border-teal-500/15 text-gray-100'
    : 'bg-white border-gray-200/90 text-gray-900';
  const headerBg = isDarkMode
    ? 'bg-gradient-to-br from-[#132520] via-[#0f1f1b] to-[#0e1a17] border-teal-500/10'
    : 'bg-gradient-to-br from-teal-50/90 via-white to-emerald-50/40 border-gray-100';
  const labelCls = isDarkMode ? 'text-gray-400' : 'text-gray-500';
  const footerBg = isDarkMode
    ? 'bg-[#0e1a17]/95 border-gray-800/80 backdrop-blur-sm'
    : 'bg-white/95 border-gray-100 backdrop-blur-sm';

  const formStyle: React.CSSProperties = isMobile
    ? { width: '100%', maxWidth: 'min(100%, 520px)', minWidth: `min(100%, ${MODAL_MIN_WIDTH}px)` }
    : { width: modalWidth, minWidth: MODAL_MIN_WIDTH, maxWidth: `calc(100vw - ${MODAL_VIEWPORT_MARGIN * 2}px)` };

  return createPortal(
    <div className={`fixed inset-0 z-50 flex items-center justify-center ${isMobile ? 'p-3' : 'p-6'}`}>
      <div
        className={`fixed inset-0 bg-black/45 backdrop-blur-sm transition-opacity duration-300 ${
          isAnimatingIn ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={handleClose}
      />

      <form
        ref={formRef}
        onSubmit={handleSubmit}
        style={formStyle}
        className={`relative z-10 rounded-2xl border flex flex-col max-h-[min(92vh,820px)] overflow-hidden transition-all duration-300 ease-out shadow-[0_28px_80px_-20px_rgba(0,0,0,0.35)] ${panelBg} ${
          isAnimatingIn ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-[0.97] translate-y-3'
        }`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="record-modal-title"
      >
        {/* Top accent */}
        <div className="h-1 flex-shrink-0 bg-gradient-to-r from-[#13C296] via-[#34d399] to-[#0ea5e9]" />

        {/* Header */}
        <div className={`px-5 py-4 border-b flex items-start justify-between gap-3 flex-shrink-0 ${headerBg}`}>
          <div className="flex items-center gap-4 min-w-0">
            <RecordAvatar url={identity.avatarUrl} name={identity.primary} />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 id="record-modal-title" className="text-lg font-bold truncate leading-tight tracking-tight">
                  {identity.primary}
                </h3>
                {statusLabel && <StatusBadge value={statusLabel} isDarkMode={isDarkMode} />}
              </div>
              {identity.secondary && (
                <p className={`text-sm truncate mt-0.5 ${labelCls}`}>{identity.secondary}</p>
              )}
              <p className={`inline-flex items-center gap-1 text-[10px] font-mono mt-1.5 px-2 py-0.5 rounded-md ${
                isDarkMode ? 'bg-black/25 text-gray-500' : 'bg-gray-100 text-gray-400'
              }`}>
                <Sparkles className="w-3 h-3 text-[#13C296]" />
                {row.rowId}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className={`p-2 rounded-xl flex-shrink-0 transition-all ${
              isDarkMode
                ? 'text-gray-400 hover:bg-white/5 hover:text-white'
                : 'text-gray-400 hover:bg-black/5 hover:text-gray-700'
            }`}
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Grouped grid sections */}
        <div className="flex-1 overflow-y-auto px-5 py-5 custom-scrollbar">
          {sections.map(({ section, fields }) => (
            <SectionBlock
              key={section}
              title={section}
              fields={fields}
              columnsCount={columnsCount}
              draftValues={draftValues}
              recordContext={recordContext}
              isDarkMode={isDarkMode}
              onFieldChange={handleFieldChange}
            />
          ))}
        </div>

        {/* Footer */}
        <div className={`px-5 py-3.5 border-t flex items-center justify-between gap-2 flex-shrink-0 shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.12)] ${footerBg}`}>
          {!isMobile && (
            <p className={`text-[10px] ${labelCls} hidden sm:block`}>
              Drag corner to resize · min {MODAL_MIN_WIDTH}px
            </p>
          )}
          <div className="flex items-center gap-2.5 ml-auto">
            <button
              type="button"
              onClick={handleClose}
              className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all ${
                isDarkMode
                  ? 'border-gray-700/80 text-gray-300 hover:bg-white/5'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-gradient-to-r from-[#13C296] to-[#10A982] hover:from-[#10A982] hover:to-[#0e9670] text-white text-xs font-bold transition-all shadow-md shadow-[#13C296]/25"
            >
              <Check className="w-4 h-4" />
              Save Changes
            </button>
          </div>
        </div>

        {!isMobile && (
          <button
            type="button"
            aria-label="Resize modal"
            onMouseDown={startResize}
            className={`absolute bottom-0 right-0 w-9 h-9 flex items-center justify-center rounded-tl-2xl cursor-ew-resize transition-colors ${
              isDarkMode
                ? 'text-gray-500 hover:text-[#13C296] hover:bg-white/5'
                : 'text-gray-400 hover:text-[#13C296] hover:bg-teal-50'
            }`}
          >
            <GripHorizontal className="w-4 h-4 -rotate-45" />
          </button>
        )}
      </form>
    </div>,
    document.body,
  );
}
