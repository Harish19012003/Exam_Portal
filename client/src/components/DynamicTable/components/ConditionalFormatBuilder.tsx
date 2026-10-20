import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import type {
  ColumnConfig,
  ConditionalFormatRule,
  DataRow,
  FormatConditionMode,
  FormatFontWeight,
  FormatOp,
  FormatScope,
} from '../types';
import { isFieldColumn } from '../types';
import { ColorPalette } from './ColorPalette';
import { evaluateConditionFormula, ruleMatches } from '../utils/conditionalFormat';

const OPS: { value: FormatOp; label: string }[] = [
  { value: 'equals', label: 'Equals' },
  { value: 'contains', label: 'Contains' },
  { value: 'gt', label: 'Greater than' },
  { value: 'gte', label: 'Greater or equal' },
  { value: 'lt', label: 'Less than' },
  { value: 'lte', label: 'Less or equal' },
  { value: 'empty', label: 'Is empty' },
  { value: 'notEmpty', label: 'Is not empty' },
];

const FONT_WEIGHTS: { value: FormatFontWeight; label: string }[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'medium', label: 'Medium' },
  { value: 'semibold', label: 'Semibold' },
  { value: 'bold', label: 'Bold' },
];

interface ConditionalFormatBuilderProps {
  columns: ColumnConfig[];
  rows?: DataRow[];
  editingRule?: ConditionalFormatRule | null;
  recentColors: string[];
  onPushRecentColor: (hex: string) => void;
  onSave: (rule: ConditionalFormatRule) => void;
  onCancel: () => void;
  isDarkMode: boolean;
}

function genRuleId(): string {
  return `cf_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Multiselect field UI for picking highlight columns (matches table multiselect look). */
function ColumnMultiSelect({
  columns,
  value,
  onChange,
  isDarkMode,
}: {
  columns: ColumnConfig[];
  value: string[];
  onChange: (keys: string[]) => void;
  isDarkMode: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (open) {
      setSearch('');
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const filtered = columns.filter(
    c => search.trim() === '' || c.label.toLowerCase().includes(search.toLowerCase()),
  );

  const selectedCols = value
    .map(k => columns.find(c => c.key === k))
    .filter(Boolean) as ColumnConfig[];

  const toggle = (key: string) => {
    onChange(value.includes(key) ? value.filter(k => k !== key) : [...value, key]);
  };

  return (
    <div ref={ref} className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={`w-full min-h-[40px] px-2.5 py-1.5 flex items-center gap-1.5 text-left rounded-lg border transition-colors outline-none
          ${open ? 'ring-2 ring-[#13C296]/20 border-[#13C296]' : ''}
          ${isDarkMode
            ? 'bg-black/20 border-gray-700 hover:border-gray-600'
            : 'bg-white border-gray-300 hover:border-gray-400'}`}
      >
        <div className="flex-1 flex flex-wrap gap-1 min-w-0">
          {selectedCols.length === 0 ? (
            <span className={`text-[13px] py-0.5 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
              Select columns…
            </span>
          ) : (
            selectedCols.map(c => (
              <span
                key={c.key}
                className={`inline-flex items-center gap-1 max-w-full pl-1.5 pr-1 py-0.5 rounded text-[11px] font-medium
                  ${isDarkMode ? 'bg-indigo-900/40 text-indigo-300' : 'bg-indigo-50 text-indigo-700'}`}
                onClick={e => e.stopPropagation()}
              >
                <span className="truncate">{c.label}</span>
                <span
                  role="button"
                  tabIndex={0}
                  aria-label={`Remove ${c.label}`}
                  onClick={e => {
                    e.stopPropagation();
                    toggle(c.key);
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.stopPropagation();
                      toggle(c.key);
                    }
                  }}
                  className={`p-0.5 rounded transition-colors
                    ${isDarkMode ? 'hover:bg-indigo-800/60' : 'hover:bg-indigo-100'}`}
                >
                  <X className="w-3 h-3" strokeWidth={2.5} />
                </span>
              </span>
            ))
          )}
        </div>
        <ChevronDown
          className={`w-4 h-4 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''} ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}
        />
      </button>

      {open && (
        <div
          className={`absolute left-0 right-0 top-full mt-1.5 z-50 rounded-xl border shadow-xl overflow-hidden flex flex-col
            ${isDarkMode ? 'bg-[#0B1E19] border-gray-700 shadow-black/40' : 'bg-white border-gray-200 shadow-gray-200'}`}
        >
          <div className={`p-2 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-100'}`}>
            <div className="relative">
              <Search className={`w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`} />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search columns…"
                className={`w-full pl-8 pr-3 py-1.5 text-[13px] rounded-md outline-none
                  ${isDarkMode ? 'bg-gray-800 text-gray-200 placeholder-gray-500' : 'bg-gray-50 text-gray-800 placeholder-gray-400'}`}
              />
            </div>
          </div>

          <div
            className={`flex items-center justify-between px-3 py-1.5 border-b text-[11px] font-semibold
              ${isDarkMode ? 'border-gray-700 text-gray-400' : 'border-gray-100 text-gray-500'}`}
          >
            <button
              type="button"
              onClick={() => onChange([...new Set([...value, ...filtered.map(c => c.key)])])}
              className="hover:text-[#13C296] transition-colors"
            >
              Select All
            </button>
            <span className={`font-normal ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
              {value.length} selected
            </span>
            <button
              type="button"
              onClick={() => {
                const filteredKeys = new Set(filtered.map(c => c.key));
                onChange(value.filter(k => !filteredKeys.has(k)));
              }}
              className="hover:text-red-500 transition-colors"
            >
              Clear All
            </button>
          </div>

          <div className="flex flex-col max-h-[200px] overflow-y-auto p-1.5">
            {filtered.length === 0 ? (
              <div className={`px-3 py-2 text-center text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                No results
              </div>
            ) : (
              filtered.map(c => {
                const isChecked = value.includes(c.key);
                return (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => toggle(c.key)}
                    className={`flex items-center w-full px-2.5 py-1.5 text-left text-[13px] rounded-md transition-colors gap-2
                      ${isChecked
                        ? isDarkMode
                          ? 'text-white'
                          : 'text-gray-900 font-medium'
                        : isDarkMode
                          ? 'text-gray-300 hover:bg-gray-700/50'
                          : 'text-gray-700 hover:bg-gray-100'}`}
                  >
                    <div
                      className={`flex items-center justify-center w-4 h-4 rounded border transition-colors flex-shrink-0
                        ${isChecked
                          ? 'bg-[#13C296] border-[#13C296]'
                          : isDarkMode
                            ? 'bg-gray-800 border-gray-600'
                            : 'bg-white border-gray-300'}`}
                    >
                      {isChecked && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                    </div>
                    <span className="flex-1 truncate">{c.label}</span>
                    <span className={`text-[10px] uppercase flex-shrink-0 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                      {c.dataType}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function ConditionalFormatBuilder({
  columns,
  rows,
  editingRule,
  recentColors,
  onPushRecentColor,
  onSave,
  onCancel,
  isDarkMode,
}: ConditionalFormatBuilderProps) {
  const fieldColumns = useMemo(
    () => columns.filter(c => isFieldColumn(c)),
    [columns],
  );

  const [name, setName] = useState(editingRule?.name ?? '');
  const [scope, setScope] = useState<FormatScope>(editingRule?.scope ?? 'cell');
  const [conditionMode, setConditionMode] = useState<FormatConditionMode>(
    editingRule?.conditionMode ?? 'simple',
  );
  const [whenColumnKey, setWhenColumnKey] = useState(
    editingRule?.whenColumnKey ?? fieldColumns[0]?.key ?? '',
  );
  const [op, setOp] = useState<FormatOp>(editingRule?.op ?? 'equals');
  const [value, setValue] = useState(
    editingRule?.value !== undefined && editingRule?.value !== null
      ? String(editingRule.value)
      : '',
  );
  const [conditionFormula, setConditionFormula] = useState(editingRule?.conditionFormula ?? '');
  const [targetColumnKeys, setTargetColumnKeys] = useState<string[]>(() => {
    if (editingRule?.targetColumnKeys?.length) return [...editingRule.targetColumnKeys];
    if (editingRule?.targetColumnKey) return [editingRule.targetColumnKey];
    return fieldColumns[0]?.key ? [fieldColumns[0].key] : [];
  });
  const [backgroundColor, setBackgroundColor] = useState(editingRule?.style.backgroundColor);
  const [color, setColor] = useState(editingRule?.style.color);
  const [fontWeight, setFontWeight] = useState<FormatFontWeight>(
    editingRule?.style.fontWeight ?? 'normal',
  );
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [previewRowIndex, setPreviewRowIndex] = useState(0);

  const formulaColumns = fieldColumns.filter(
    c =>
      ['number', 'currency', 'progress', 'date', 'datetime', 'time', 'boolean', 'checkbox', 'text', 'email', 'phone', 'rating', 'formula', 'dropdown', 'status'].includes(
        c.dataType,
      ) &&
      (searchQuery.trim() === '' || c.label.toLowerCase().includes(searchQuery.toLowerCase())),
  );

  const needsValue = op !== 'empty' && op !== 'notEmpty';

  const sampleRow = rows?.[previewRowIndex] ?? rows?.[0];

  const previewRule: ConditionalFormatRule = {
    id: editingRule?.id ?? '__preview__',
    name: name.trim() || undefined,
    scope,
    conditionMode,
    whenColumnKey: conditionMode === 'simple' ? whenColumnKey : undefined,
    op: conditionMode === 'simple' ? op : undefined,
    value:
      conditionMode === 'simple' && needsValue && value.trim() !== ''
        ? /^-?\d+(\.\d+)?$/.test(value.trim())
          ? Number(value.trim())
          : value
        : undefined,
    conditionFormula: conditionMode === 'formula' ? conditionFormula : undefined,
    targetColumnKeys: scope === 'cell' ? targetColumnKeys : undefined,
    style: {
      backgroundColor: backgroundColor || undefined,
      color: color || undefined,
      fontWeight,
    },
    enabled: true,
  };

  const previewMatch = sampleRow ? ruleMatches(sampleRow, previewRule, columns) : false;
  const formulaPreview =
    conditionMode === 'formula' && sampleRow && conditionFormula.trim()
      ? evaluateConditionFormula(conditionFormula, sampleRow, columns)
      : undefined;

  const handleSave = () => {
    if (conditionMode === 'simple') {
      if (!whenColumnKey) {
        setError('Select a column to match on');
        return;
      }
      if (needsValue && value.trim() === '') {
        setError('Enter a comparison value');
        return;
      }
    } else if (!conditionFormula.trim()) {
      setError('Enter a condition formula');
      return;
    }

    if (scope === 'cell' && targetColumnKeys.length === 0) {
      setError('Select at least one column to highlight');
      return;
    }

    if (!backgroundColor && !color && fontWeight === 'normal') {
      setError('Choose at least one style (color or weight)');
      return;
    }

    const parsedValue =
      conditionMode === 'simple' && needsValue
        ? /^-?\d+(\.\d+)?$/.test(value.trim())
          ? Number(value.trim())
          : value
        : undefined;

    const rule: ConditionalFormatRule = {
      id: editingRule?.id ?? genRuleId(),
      name: name.trim() || undefined,
      scope,
      conditionMode,
      whenColumnKey: conditionMode === 'simple' ? whenColumnKey : undefined,
      op: conditionMode === 'simple' ? op : undefined,
      value: parsedValue,
      conditionFormula: conditionMode === 'formula' ? conditionFormula.trim() : undefined,
      targetColumnKeys: scope === 'cell' ? targetColumnKeys : undefined,
      style: {
        ...(backgroundColor ? { backgroundColor } : {}),
        ...(color ? { color } : {}),
        fontWeight,
      },
      enabled: editingRule?.enabled ?? true,
    };

    onSave(rule);
  };

  const selectClass = `w-full px-3 py-2 text-[13px] rounded-lg border focus:ring-2 focus:ring-[#13C296]/20 outline-none transition-all
    ${isDarkMode ? 'bg-black/20 border-gray-700 focus:border-[#13C296] text-gray-200' : 'bg-white border-gray-300 focus:border-[#13C296] text-gray-800'}`;

  const labelClass = `text-[11px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`;

  return (
    <div className={`flex flex-col h-full ${isDarkMode ? 'bg-[#0B1E19] text-gray-200' : 'bg-white text-gray-800'}`}>
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-lg text-[13px]">
            {error}
          </div>
        )}

        <div className="space-y-1.5">
          <label className={labelClass}>Rule name (optional)</label>
          <input
            type="text"
            value={name}
            onChange={e => { setName(e.target.value); setError(null); }}
            placeholder="e.g. Inactive highlight"
            className={selectClass}
          />
        </div>

        <div className="space-y-1.5">
          <label className={labelClass}>Apply to</label>
          <div className="grid grid-cols-2 gap-2">
            {([
              { value: 'cell' as const, label: 'Specific column' },
              { value: 'row' as const, label: 'Entire row' },
            ]).map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setScope(opt.value)}
                className={`py-2 px-3 rounded-lg border text-[13px] font-medium transition-colors
                  ${scope === opt.value
                    ? isDarkMode
                      ? 'bg-[#13C296]/10 border-[#13C296]/60 text-[#13C296]'
                      : 'bg-[#13C296]/5 border-[#13C296] text-[#0f9f7a]'
                    : isDarkMode
                      ? 'border-gray-700 text-gray-400 hover:border-gray-600'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {scope === 'cell' && (
          <div className="space-y-1.5">
            <label className={labelClass}>Highlight columns</label>
            <ColumnMultiSelect
              columns={fieldColumns}
              value={targetColumnKeys}
              onChange={keys => {
                setTargetColumnKeys(keys);
                setError(null);
              }}
              isDarkMode={isDarkMode}
            />
            <p className={`text-[11px] ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
              {targetColumnKeys.length === 0
                ? 'No columns selected'
                : `${targetColumnKeys.length} column${targetColumnKeys.length === 1 ? '' : 's'} will be styled`}
            </p>
          </div>
        )}

        <div className="space-y-1.5">
          <label className={labelClass}>Condition</label>
          <div className="grid grid-cols-2 gap-2">
            {([
              { value: 'simple' as const, label: 'Simple' },
              { value: 'formula' as const, label: 'Formula' },
            ]).map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => { setConditionMode(opt.value); setError(null); }}
                className={`py-2 px-3 rounded-lg border text-[13px] font-medium transition-colors
                  ${conditionMode === opt.value
                    ? isDarkMode
                      ? 'bg-[#13C296]/10 border-[#13C296]/60 text-[#13C296]'
                      : 'bg-[#13C296]/5 border-[#13C296] text-[#0f9f7a]'
                    : isDarkMode
                      ? 'border-gray-700 text-gray-400 hover:border-gray-600'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {conditionMode === 'simple' ? (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className={labelClass}>When column</label>
              <select
                value={whenColumnKey}
                onChange={e => setWhenColumnKey(e.target.value)}
                className={selectClass}
              >
                {fieldColumns.map(c => (
                  <option key={c.key} value={c.key}>{c.label}</option>
                ))}
              </select>
            </div>
            <div className={`grid gap-2 ${needsValue ? 'grid-cols-2' : 'grid-cols-1'}`}>
              <div className="space-y-1.5 min-w-0">
                <label className={labelClass}>Operator</label>
                <select
                  value={op}
                  onChange={e => setOp(e.target.value as FormatOp)}
                  className={selectClass}
                >
                  {OPS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              {needsValue && (
                <div className="space-y-1.5 min-w-0">
                  <label className={labelClass}>Value</label>
                  <input
                    type="text"
                    value={value}
                    onChange={e => { setValue(e.target.value); setError(null); }}
                    placeholder="Comparison value"
                    className={selectClass}
                  />
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className={labelClass}>Condition formula</label>
              <textarea
                value={conditionFormula}
                onChange={e => { setConditionFormula(e.target.value); setError(null); }}
                placeholder='e.g. {salary} > 100000 && {status} == "Active"'
                rows={3}
                className={`${selectClass} font-mono`}
              />
              <p className={`text-[11px] ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                Truthy result applies the style. Use {'{column}'} refs, comparisons, IF, &&, ||.
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label className={labelClass}>Insert column</label>
                <div className="relative">
                  <Search className={`absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`} />
                  <input
                    type="text"
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className={`pl-7 pr-2 py-1.5 text-[11px] rounded-md border outline-none w-[140px]
                      ${isDarkMode ? 'bg-black/20 border-gray-700 text-gray-300' : 'bg-white border-gray-300 text-gray-700'}`}
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-[120px] overflow-y-auto">
                {formulaColumns.map(c => (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() =>
                      setConditionFormula(prev =>
                        prev + (prev.endsWith(' ') || prev.length === 0 ? '' : ' ') + `{${c.key}} `,
                      )
                    }
                    className={`text-[11px] font-medium px-2 py-1 rounded-md border transition-colors
                      ${isDarkMode
                        ? 'border-gray-700 text-gray-300 hover:border-[#13C296]/50 hover:text-[#13C296]'
                        : 'border-gray-200 text-gray-600 hover:border-[#13C296] hover:text-[#0f9f7a]'}`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <label className={labelClass}>Style</label>
          <div className="grid grid-cols-3 gap-2">
            <ColorPalette
              label="Background"
              value={backgroundColor}
              recentColors={recentColors}
              onSelect={hex => {
                setBackgroundColor(hex);
                onPushRecentColor(hex);
                setError(null);
              }}
              onClear={() => setBackgroundColor(undefined)}
              isDarkMode={isDarkMode}
              compact
            />
            <ColorPalette
              label="Font color"
              value={color}
              recentColors={recentColors}
              onSelect={hex => {
                setColor(hex);
                onPushRecentColor(hex);
                setError(null);
              }}
              onClear={() => setColor(undefined)}
              isDarkMode={isDarkMode}
              compact
            />
            <div className="space-y-1.5 min-w-0">
              <label className={labelClass}>Font weight</label>
              <select
                value={fontWeight}
                onChange={e => setFontWeight(e.target.value as FormatFontWeight)}
                className={selectClass}
              >
                {FONT_WEIGHTS.map(w => (
                  <option key={w.value} value={w.value}>{w.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {sampleRow && (
          <div className={`p-3 rounded-lg border space-y-2 ${isDarkMode ? 'border-gray-700 bg-black/20' : 'border-gray-200 bg-gray-50'}`}>
            <div className="flex items-center justify-between">
              <span className={labelClass}>Preview</span>
              {rows && rows.length > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={previewRowIndex <= 0}
                    onClick={() => setPreviewRowIndex(i => Math.max(0, i - 1))}
                    className={`px-2 py-0.5 text-[11px] rounded border disabled:opacity-40
                      ${isDarkMode ? 'border-gray-600' : 'border-gray-300'}`}
                  >
                    Prev
                  </button>
                  <span className={`text-[11px] ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    {previewRowIndex + 1}/{rows.length}
                  </span>
                  <button
                    type="button"
                    disabled={previewRowIndex >= rows.length - 1}
                    onClick={() => setPreviewRowIndex(i => Math.min(rows.length - 1, i + 1))}
                    className={`px-2 py-0.5 text-[11px] rounded border disabled:opacity-40
                      ${isDarkMode ? 'border-gray-600' : 'border-gray-300'}`}
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
            <div
              className="px-3 py-2 rounded-md text-[13px] truncate"
              style={{
                backgroundColor: previewMatch ? backgroundColor : undefined,
                color: previewMatch ? color : undefined,
                fontWeight: previewMatch
                  ? fontWeight === 'bold'
                    ? 700
                    : fontWeight === 'semibold'
                      ? 600
                      : fontWeight === 'medium'
                        ? 500
                        : 400
                  : undefined,
              }}
            >
              Sample cell · {previewMatch ? 'matches' : 'no match'}
              {conditionMode === 'formula' && (
                <span className={`ml-2 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                  ({String(formulaPreview ?? '—')})
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      <div className={`flex gap-2 p-4 border-t flex-shrink-0 ${isDarkMode ? 'border-gray-700' : 'border-gray-100'}`}>
        <button
          type="button"
          onClick={onCancel}
          className={`flex-1 py-2.5 rounded-lg border text-[13px] font-medium transition-colors
            ${isDarkMode ? 'border-gray-600 text-gray-300 hover:bg-white/5' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          className="flex-1 py-2.5 rounded-lg bg-[#13C296] text-white text-[13px] font-semibold hover:bg-[#0f9f7a] transition-colors"
        >
          {editingRule ? 'Update rule' : 'Save rule'}
        </button>
      </div>
    </div>
  );
}
