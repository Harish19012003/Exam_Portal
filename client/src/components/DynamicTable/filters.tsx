import { useState } from 'react';
import { isFieldColumn } from './types';
import type { FilterComponentProps } from './types';
import { STATUS_COLORS } from './utils';

// ─── Shared panel styles ───────────────────────────────────────────────────────

function inputCls(isDarkMode: boolean) {
  return `w-full px-3 py-2 rounded-lg border text-[13px] outline-none transition-all
    focus:ring-2 focus:ring-[#13C296]/20 focus:border-[#13C296]
    ${isDarkMode
      ? 'bg-gray-800 border-gray-700 text-gray-200 placeholder-gray-600'
      : 'bg-white border-gray-200 text-gray-800 placeholder-gray-400'}`;
}

function selectCls(isDarkMode: boolean) {
  return inputCls(isDarkMode) + ' cursor-pointer';
}

function BtnApply({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex-1 py-1.5 rounded-lg text-[12px] font-bold bg-[#13C296] hover:bg-[#0f9f7a] text-white transition-colors"
    >
      Apply
    </button>
  );
}

function BtnClear({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex-1 py-1.5 rounded-lg text-[12px] font-bold border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
    >
      Clear
    </button>
  );
}

// ─── Text Filter ───────────────────────────────────────────────────────────────

export function TextFilter({ currentFilter, onFilterChange, onClose, isDarkMode }: FilterComponentProps) {
  const cf = currentFilter as any;
  const [op, setOp] = useState<'contains' | 'equals' | 'startsWith'>(cf?.op ?? 'contains');
  const [value, setValue] = useState<string>(cf?.value ?? '');

  const apply = () => {
    if (!value.trim()) { onFilterChange(null); onClose(); return; }
    onFilterChange({ op, value: value.trim() });
    onClose();
  };

  return (
    <div className="flex flex-col gap-2">
      <select value={op} onChange={e => setOp(e.target.value as any)} className={selectCls(isDarkMode)}>
        <option value="contains">Contains</option>
        <option value="equals">Equals</option>
        <option value="startsWith">Starts with</option>
      </select>
      <input
        autoFocus
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') apply(); if (e.key === 'Escape') onClose(); }}
        placeholder="Filter value…"
        className={inputCls(isDarkMode)}
      />
      <div className="flex gap-2 mt-1">
        <BtnClear onClick={() => { onFilterChange(null); onClose(); }} />
        <BtnApply onClick={apply} />
      </div>
    </div>
  );
}

// ─── Number / Currency Filter ─────────────────────────────────────────────────

export function NumberFilter({ currentFilter, onFilterChange, onClose, isDarkMode }: FilterComponentProps) {
  const cf = currentFilter as any;
  const [min, setMin] = useState<string>(cf?.value != null ? String(cf.value) : '');
  const [max, setMax] = useState<string>(cf?.value2 != null ? String(cf.value2) : '');

  const apply = () => {
    const v1 = min !== '' ? Number(min) : null;
    const v2 = max !== '' ? Number(max) : null;
    if (v1 === null && v2 === null) { onFilterChange(null); onClose(); return; }
    onFilterChange({ op: 'between', value: v1, value2: v2 });
    onClose();
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          type="number"
          placeholder="Min"
          value={min}
          onChange={e => setMin(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') apply(); if (e.key === 'Escape') onClose(); }}
          className={inputCls(isDarkMode)}
          autoFocus
        />
        <input
          type="number"
          placeholder="Max"
          value={max}
          onChange={e => setMax(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') apply(); if (e.key === 'Escape') onClose(); }}
          className={inputCls(isDarkMode)}
        />
      </div>
      <div className="flex gap-2 mt-1">
        <BtnClear onClick={() => { onFilterChange(null); onClose(); }} />
        <BtnApply onClick={apply} />
      </div>
    </div>
  );
}

// ─── Status / Dropdown Filter (multi-checkbox) ─────────────────────────────────

export function SetFilter({ column, currentFilter, onFilterChange, onClose, isDarkMode }: FilterComponentProps) {
  const options = isFieldColumn(column) ? (column.options ?? []) : [];
  const cf = currentFilter as any;
  const [selected, setSelected] = useState<string[]>(cf?.value ?? []);

  const toggle = (opt: string) => {
    setSelected(prev =>
      prev.includes(opt) ? prev.filter(s => s !== opt) : [...prev, opt]
    );
  };

  const apply = () => {
    if (!selected.length) { onFilterChange(null); onClose(); return; }
    onFilterChange({ op: 'in', value: selected });
    onClose();
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="max-h-[160px] overflow-y-auto flex flex-col gap-0.5">
        {options.map(opt => {
          const colors = STATUS_COLORS[opt];
          const isChecked = selected.includes(opt);
          return (
            <label
              key={opt}
              className={`flex items-center gap-2.5 px-2 py-1.5 rounded-lg cursor-pointer transition-colors
                ${isDarkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-50'}`}
            >
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => toggle(opt)}
                className="w-3.5 h-3.5 accent-[#13C296] rounded cursor-pointer"
                aria-label={opt}
              />
              {colors ? (
                <span className={`flex items-center gap-1.5 text-[12px] font-semibold
                  ${isDarkMode ? colors.dark : colors.light} px-2 py-0.5 rounded-full`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
                  {opt}
                </span>
              ) : (
                <span className={`text-[13px] ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>{opt}</span>
              )}
            </label>
          );
        })}
      </div>
      <div className="flex gap-2 mt-2">
        <BtnClear onClick={() => { onFilterChange(null); onClose(); }} />
        <BtnApply onClick={apply} />
      </div>
    </div>
  );
}

// ─── Date Filter ──────────────────────────────────────────────────────────────

export function DateFilter({ currentFilter, onFilterChange, onClose, isDarkMode }: FilterComponentProps) {
  const cf = currentFilter as any;
  const [from, setFrom] = useState<string>(cf?.value ?? '');
  const [to, setTo] = useState<string>(cf?.value2 ?? '');

  const apply = () => {
    if (!from && !to) { onFilterChange(null); onClose(); return; }
    onFilterChange({ op: 'between', value: from || null, value2: to || null } as any);
    onClose();
  };

  return (
    <div className="flex flex-col gap-2">
      <div>
        <label className={`text-[11px] font-bold mb-1 block ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>From</label>
        <input type="date" value={from} onChange={e => setFrom(e.target.value)} className={inputCls(isDarkMode)} autoFocus />
      </div>
      <div>
        <label className={`text-[11px] font-bold mb-1 block ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>To</label>
        <input type="date" value={to} onChange={e => setTo(e.target.value)} className={inputCls(isDarkMode)} />
      </div>
      <div className="flex gap-2 mt-1">
        <BtnClear onClick={() => { onFilterChange(null); onClose(); }} />
        <BtnApply onClick={apply} />
      </div>
    </div>
  );
}

// ─── Boolean Filter ───────────────────────────────────────────────────────────

export function BooleanFilter({ currentFilter, onFilterChange, onClose, isDarkMode }: FilterComponentProps) {
  const cf = currentFilter as any;
  const [val, setVal] = useState<'true' | 'false' | ''>(
    cf?.value === true ? 'true' : cf?.value === false ? 'false' : ''
  );

  const apply = () => {
    if (val === '') { onFilterChange(null); onClose(); return; }
    onFilterChange({ op: 'equals', value: val === 'true' });
    onClose();
  };

  const base = `px-3 py-1.5 rounded-lg text-[12px] font-semibold border transition-colors flex-1 text-center
    ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        {(['', 'true', 'false'] as const).map(v => (
          <button
            key={v}
            onClick={() => setVal(v)}
            className={base + ' ' + (val === v
              ? 'bg-[#13C296] text-white border-[#13C296]'
              : (isDarkMode ? 'text-gray-300 hover:bg-gray-800' : 'text-gray-600 hover:bg-gray-50'))}
          >
            {v === '' ? 'Any' : v === 'true' ? 'Yes' : 'No'}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <BtnClear onClick={() => { onFilterChange(null); onClose(); }} />
        <BtnApply onClick={apply} />
      </div>
    </div>
  );
}

// ─── Filter Dispatcher ────────────────────────────────────────────────────────

export function FilterUI(props: FilterComponentProps) {
  const { column } = props;
  const dt = isFieldColumn(column) ? column.dataType : 'text';

  switch (dt) {
    case 'number':
    case 'currency':
    case 'percent':
      return <NumberFilter {...props} />;
    case 'status':
    case 'dropdown':
    case 'select':
    case 'multiselect':
    case 'tags':
      return <SetFilter {...props} />;
    case 'date':
    case 'datetime':
      return <DateFilter {...props} />;
    case 'boolean':
      return <BooleanFilter {...props} />;
    default:
      return <TextFilter {...props} />;
  }
}
