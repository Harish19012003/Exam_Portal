import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Plus, Trash2 } from 'lucide-react';
import type { AggregationType, ColumnConfig, SummaryChipConfig } from '../DynamicTable/types';
import { isFieldColumn, MAX_AGGREGATIONS_PER_CHIP } from '../DynamicTable/types';
import { AGGREGATION_LABELS, getAggregationOptionsForColumn } from '../DynamicTable/utils/formatAggregation';
import { getDefaultAggregationForType, getEffectiveDataType } from '../DynamicTable/utils/evaluateFormula';
import { useSummaryChipsStore } from './summaryChipsStore';

interface SelectOption {
  value: string;
  label: string;
}

function defaultChipAggregation(col: ColumnConfig | undefined): AggregationType {
  if (!col || !isFieldColumn(col)) return 'count';
  const allowed = getAggregationOptionsForColumn(col);
  const preferred = getDefaultAggregationForType(getEffectiveDataType(col));
  if (preferred && allowed.includes(preferred)) return preferred;
  return allowed[0] ?? 'count';
}

function normalizeChips(chips: SummaryChipConfig[], fieldColumns: ColumnConfig[]): SummaryChipConfig[] {
  return chips.map(chip => {
    const legacy = (chip as SummaryChipConfig & { aggregation?: AggregationType }).aggregation;
    const fromArray = chip.aggregations?.length ? chip.aggregations : undefined;
    const fromLegacy = legacy ? [legacy] : undefined;
    return {
      ...chip,
      aggregations: (
        fromArray ??
        fromLegacy ??
        [defaultChipAggregation(fieldColumns.find(c => c.key === chip.fieldKey) ?? fieldColumns[0])]
      ).slice(0, MAX_AGGREGATIONS_PER_CHIP),
    };
  });
}

function FieldSelect({
  value,
  columns,
  onChange,
  isDarkMode,
}: {
  value?: string;
  columns: ColumnConfig[];
  onChange: (val: string) => void;
  isDarkMode: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const selectedCol = columns.find(c => c.key === value) || columns[0];
  const getColText = (col?: ColumnConfig) => {
    if (!col) return 'Select field';
    return (col as { label?: string; header?: string }).label ||
      (col as { header?: string }).header ||
      col.key;
  };

  return (
    <div className="relative flex-1" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className={`flex w-full items-center justify-between gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-all ${
          isOpen
            ? 'border-[#13C296] ring-2 ring-[#13C296]/20'
            : isDarkMode
              ? 'border-gray-700 bg-[#182d27] text-gray-200 hover:border-gray-600'
              : 'border-gray-300 bg-white text-gray-800 hover:border-gray-400'
        }`}
      >
        <span className="truncate">{getColText(selectedCol)}</span>
        <ChevronDown className={`h-3.5 w-3.5 text-gray-400 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180 text-[#13C296]' : ''}`} />
      </button>

      {isOpen && (
        <div
          className={`absolute left-0 top-full z-50 mt-1 max-h-44 w-full min-w-[180px] overflow-y-auto custom-scrollbar rounded-xl border p-1 shadow-xl backdrop-blur-md ${
            isDarkMode
              ? 'border-gray-700 bg-[#182d27]/95 text-gray-200'
              : 'border-gray-200 bg-white/95 text-gray-800'
          }`}
        >
          {columns.map(col => {
            const isSelected = col.key === (value || columns[0]?.key);
            return (
              <button
                key={col.key}
                type="button"
                onClick={() => {
                  onChange(col.key);
                  setIsOpen(false);
                }}
                className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  isSelected
                    ? 'bg-[#13C296]/15 text-[#13C296] font-semibold'
                    : isDarkMode
                      ? 'hover:bg-gray-800/80 hover:text-white'
                      : 'hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <span className="truncate">{getColText(col)}</span>
                {isSelected && <Check className="h-3.5 w-3.5 text-[#13C296] flex-shrink-0 ml-1" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AggMultiSelect({
  values,
  options,
  onChange,
  isDarkMode,
  max = MAX_AGGREGATIONS_PER_CHIP,
}: {
  values: string[];
  options: SelectOption[];
  onChange: (vals: string[]) => void;
  isDarkMode: boolean;
  max?: number;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const selected = options.filter(o => values.includes(o.value));
  const atMax = values.length >= max;

  const toggle = (val: string) => {
    if (values.includes(val)) {
      if (values.length <= 1) return;
      onChange(values.filter(v => v !== val));
      return;
    }
    if (atMax) return;
    onChange([...values, val]);
  };

  return (
    <div className="relative w-full min-w-0" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className={`flex w-full items-center justify-between gap-1.5 rounded-lg border px-2 py-1.5 min-h-[34px] text-xs font-semibold transition-all ${
          isOpen
            ? 'border-[#13C296] ring-2 ring-[#13C296]/20'
            : isDarkMode
              ? 'border-gray-700 bg-[#182d27] text-gray-200 hover:border-gray-600'
              : 'border-gray-300 bg-white text-gray-800 hover:border-gray-400'
        }`}
      >
        <div className="flex flex-wrap items-center gap-1 min-w-0 flex-1">
          {selected.length === 0 ? (
            <span className={isDarkMode ? 'text-gray-500' : 'text-gray-400'}>Select aggregations</span>
          ) : (
            selected.map(opt => (
              <span
                key={opt.value}
                className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                  isDarkMode ? 'bg-[#13C296]/20 text-[#13C296]' : 'bg-[#13C296]/15 text-[#0a8066]'
                }`}
              >
                {opt.label}
              </span>
            ))
          )}
        </div>
        <ChevronDown className={`h-3.5 w-3.5 text-gray-400 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180 text-[#13C296]' : ''}`} />
      </button>

      {isOpen && (
        <div
          className={`absolute left-0 top-full z-50 mt-1 w-full min-w-[180px] max-h-52 overflow-y-auto custom-scrollbar rounded-xl border p-1 shadow-xl backdrop-blur-md ${
            isDarkMode
              ? 'border-gray-700 bg-[#182d27]/95 text-gray-200'
              : 'border-gray-200 bg-white/95 text-gray-800'
          }`}
        >
          <div className={`px-2 py-1 text-[10px] font-semibold uppercase tracking-wider ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
            {values.length}/{max} selected
          </div>
          {options.map(opt => {
            const isSelected = values.includes(opt.value);
            const disabled = !isSelected && atMax;
            return (
              <button
                key={opt.value}
                type="button"
                disabled={disabled}
                onClick={() => toggle(opt.value)}
                className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                  isSelected
                    ? 'bg-[#13C296]/15 text-[#13C296] font-semibold'
                    : isDarkMode
                      ? 'hover:bg-gray-800/80 hover:text-white'
                      : 'hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <span
                  className={`flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded border ${
                    isSelected
                      ? 'border-[#13C296] bg-[#13C296] text-[#111c18]'
                      : isDarkMode
                        ? 'border-gray-600'
                        : 'border-gray-300'
                  }`}
                >
                  {isSelected && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                </span>
                <span className="truncate flex-1 text-left">{opt.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export interface SummaryChipsEditorProps {
  isDarkMode: boolean;
  columns: ColumnConfig[];
  /** Compact header when nested under a toggle row. */
  compact?: boolean;
}

/** Field + aggregation editor bound to the shared summary chips store. */
export function SummaryChipsEditor({ isDarkMode, columns, compact = false }: SummaryChipsEditorProps) {
  const { chips: storeChips, setChips } = useSummaryChipsStore();
  const fieldColumns = columns.filter(isFieldColumn);
  const summaryChips = normalizeChips(storeChips, fieldColumns);

  const handleAdd = () => {
    if (fieldColumns.length === 0) return;
    const used = new Set(summaryChips.map(c => c.fieldKey));
    const nextCol = fieldColumns.find(c => !used.has(c.key)) ?? fieldColumns[0];
    setChips([
      ...summaryChips,
      {
        id: `chip_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        fieldKey: nextCol.key,
        aggregations: [defaultChipAggregation(nextCol)],
      },
    ]);
  };

  const handleUpdate = (id: string, updates: Partial<SummaryChipConfig>) => {
    setChips(
      summaryChips.map(chip => {
        if (chip.id !== id) return chip;
        const next = { ...chip, ...updates };
        if (updates.fieldKey) {
          const col = fieldColumns.find(c => c.key === updates.fieldKey);
          if (col) {
            const allowed = getAggregationOptionsForColumn(col);
            const kept = next.aggregations.filter(a => allowed.includes(a)).slice(0, MAX_AGGREGATIONS_PER_CHIP);
            next.aggregations = kept.length > 0 ? kept : [defaultChipAggregation(col)];
          }
        }
        if (updates.aggregations) {
          next.aggregations = updates.aggregations.slice(0, MAX_AGGREGATIONS_PER_CHIP);
        }
        return next;
      }),
    );
  };

  const handleRemove = (id: string) => {
    setChips(summaryChips.filter(c => c.id !== id));
  };

  return (
    <div className={`flex flex-col gap-2 ${compact ? 'py-1' : ''}`}>
      <div className="flex items-center justify-between text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
        <span>Headline stats</span>
        <span className="text-[10px] font-mono text-[#13C296]">
          {summaryChips.length} {summaryChips.length === 1 ? 'chip' : 'chips'}
        </span>
      </div>

      {summaryChips.length === 0 ? (
        <div
          className={`p-3 rounded-xl border border-dashed text-center text-xs ${
            isDarkMode ? 'border-gray-800 text-gray-400 bg-gray-900/30' : 'border-gray-200 text-gray-500 bg-gray-50'
          }`}
        >
          No chips yet. Add a field and up to 3 aggregations to show above every view.
        </div>
      ) : (
        <div className="space-y-2">
          {summaryChips.map(chip => {
            const col = fieldColumns.find(c => c.key === chip.fieldKey);
            const aggOptions = (col ? getAggregationOptionsForColumn(col) : (['count'] as AggregationType[])).map(
              opt => ({
                value: opt,
                label: AGGREGATION_LABELS[opt],
              }),
            );
            return (
              <div
                key={chip.id}
                className={`flex flex-col gap-2 p-2.5 rounded-xl border ${
                  isDarkMode ? 'border-[#13C296]/30 bg-[#182d27]/70' : 'border-[#13C296]/25 bg-teal-50/40'
                }`}
              >
                <div className="flex items-center gap-2">
                  <FieldSelect
                    value={chip.fieldKey}
                    columns={fieldColumns}
                    onChange={val => handleUpdate(chip.id, { fieldKey: val })}
                    isDarkMode={isDarkMode}
                  />
                  <button
                    type="button"
                    onClick={() => handleRemove(chip.id)}
                    className="p-1 rounded text-rose-400 hover:bg-rose-500/20 transition-colors flex-shrink-0"
                    title="Remove chip"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <AggMultiSelect
                  values={chip.aggregations}
                  options={aggOptions}
                  onChange={vals => handleUpdate(chip.id, { aggregations: vals as AggregationType[] })}
                  isDarkMode={isDarkMode}
                />
              </div>
            );
          })}
        </div>
      )}

      <button
        type="button"
        onClick={handleAdd}
        disabled={fieldColumns.length === 0}
        className={`w-full mt-0.5 flex items-center justify-center gap-2 rounded-xl border-2 border-dashed px-3 py-2 text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
          isDarkMode
            ? 'border-[#13C296]/40 text-[#13C296] hover:bg-[#13C296]/15 hover:border-[#13C296]'
            : 'border-[#13C296]/50 text-[#13C296] hover:bg-[#13C296]/10 hover:border-[#13C296]'
        }`}
      >
        <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
        <span>Add chip</span>
      </button>
    </div>
  );
}
