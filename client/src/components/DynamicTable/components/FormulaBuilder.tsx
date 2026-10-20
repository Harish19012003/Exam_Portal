import { useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, Check, Hash, DollarSign, Percent, ChevronLeft, ChevronRight, Calendar, Type, Clock, Search } from 'lucide-react';
import type { ColumnConfig, DataType, DataRow, FieldColumn } from '../types';
import { isFieldColumn } from '../types';
import { CellRenderer } from '../renderers';
import { resolveAggregationForResultType } from '../utils/formatAggregation';

interface FormulaBuilderProps {
  columns: ColumnConfig[];
  onSave: (col: ColumnConfig) => void;
  onCancel: () => void;
  isDarkMode: boolean;
  editingKey?: string | null;
  rows?: DataRow[];
}

const RESULT_TYPES: { type: DataType; label: string; icon: React.FC<{ className?: string; strokeWidth?: number }> }[] = [
  { type: 'number', label: 'Number', icon: Hash },
  { type: 'currency', label: 'Currency', icon: DollarSign },
  { type: 'progress', label: 'Percent', icon: Percent },
  { type: 'date', label: 'Date', icon: Calendar },
  { type: 'datetime', label: 'Datetime', icon: Clock },
  { type: 'time', label: 'Time', icon: Clock },
  { type: 'text', label: 'Text', icon: Type },
];

export function FormulaBuilder({ columns, onSave, isDarkMode, editingKey, rows }: FormulaBuilderProps) {
  const existingCol: FieldColumn | null = (() => {
    if (!editingKey) return null;
    const col = columns.find(c => c.key === editingKey);
    return col && isFieldColumn(col) && col.dataType === 'formula' ? col : null;
  })();
  
  const [name, setName] = useState(existingCol?.label || '');
  const [formula, setFormula] = useState(existingCol?.formula || '');
  const [resultType, setResultType] = useState<DataType>(existingCol?.resultType || 'number');
  const [error, setError] = useState<string | null>(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  
  const [previewRowIndex, setPreviewRowIndex] = useState(0);

  // Filter columns that can be used in formulas (math, logic, text, formula)
  // Exclude the currently editing column to prevent direct self-reference
  const formulaColumns = columns.filter(c => 
    ['number', 'currency', 'progress', 'date', 'datetime', 'time', 'boolean', 'checkbox', 'text', 'email', 'phone', 'rating', 'formula'].includes(c.dataType) &&
    c.key !== editingKey &&
    (searchQuery.trim() === '' || c.label.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleSave = () => {
    if (!name.trim()) {
      setError('Column name is required');
      return;
    }
    if (!formula.trim()) {
      setError('Formula is required');
      return;
    }

    const key = existingCol ? existingCol.key : name.toLowerCase().replace(/[^a-z0-9]/g, '_');

    const aggregation = resolveAggregationForResultType(resultType, existingCol?.aggregation);

    const newCol: FieldColumn = {
      ...(existingCol || { key, label: name, order: 999, visible: true, pinned: null, width: 150 }),
      key,
      label: name,
      dataType: 'formula',
      formula,
      resultType,
      order: existingCol ? existingCol.order : 999,
      visible: existingCol ? existingCol.visible : true,
      pinned: existingCol ? existingCol.pinned : null,
      width: existingCol ? existingCol.width : 150,
      editable: false,
      aggregation,
    };

    onSave(newCol);
  };

  const insertVariable = (colKey: string) => {
    setFormula((prev: string) => prev + (prev.endsWith(' ') || prev.length === 0 ? '' : ' ') + `{${colKey}} `);
  };

  return (
    <div className={`flex flex-col h-full ${isDarkMode ? 'bg-[#0B1E19] text-gray-200' : 'bg-white text-gray-800'}`}>


      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-lg text-[13px]">
            {error}
          </div>
        )}

        <div className="space-y-1.5">
          <label className={`text-[11px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            Column Name
          </label>
          <input
            type="text"
            value={name}
            onChange={e => { setName(e.target.value); setError(null); }}
            placeholder="e.g. Total Compensation"
            className={`w-full px-3 py-2 text-[13px] rounded-lg border focus:ring-2 focus:ring-[#13C296]/20 outline-none transition-all
              ${isDarkMode ? 'bg-black/20 border-gray-700 focus:border-[#13C296]' : 'bg-white border-gray-300 focus:border-[#13C296]'}`}
          />
        </div>

        <div className="space-y-2">
          <label className={`text-[11px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            Result Type
          </label>
          <div className="grid grid-cols-3 gap-2.5">
            {RESULT_TYPES.map(type => {
              const isActive = resultType === type.type;
              return (
                <button
                  key={type.type}
                  onClick={() => setResultType(type.type)}
                  className={`relative flex flex-col items-center justify-center py-3 px-2 gap-2 rounded-[14px] border transition-all duration-300 group
                    ${isActive 
                      ? (isDarkMode ? 'bg-[#13C296]/10 border-[#13C296]/60 shadow-[0_4px_20px_rgba(19,194,150,0.15)]' : 'bg-[#13C296]/5 border-[#13C296] shadow-[0_4px_15px_rgba(19,194,150,0.08)]') 
                      : (isDarkMode ? 'bg-gray-800/30 border-gray-700/50 hover:bg-gray-800/80 hover:border-gray-600' : 'bg-white border-gray-200/70 hover:border-gray-300 hover:bg-gray-50 hover:shadow-sm')
                    }`}
                >
                  {isActive && (
                    <div className="absolute top-1.5 right-1.5 w-3.5 h-3.5 bg-[#13C296] rounded-full flex items-center justify-center shadow-sm">
                      <Check className="w-2.5 h-2.5 text-white" strokeWidth={3.5} />
                    </div>
                  )}
                  <div className={`p-2 rounded-xl transition-colors duration-300 ${isActive ? (isDarkMode ? 'bg-[#13C296]/20' : 'bg-white shadow-sm') : 'bg-transparent group-hover:scale-110'}`}>
                    <type.icon 
                      className={`w-5 h-5 transition-transform duration-300 ${isActive ? 'text-[#13C296] scale-110' : (isDarkMode ? 'text-gray-400' : 'text-gray-500')}`} 
                      strokeWidth={isActive ? 2.5 : 2} 
                    />
                  </div>
                  <span className={`text-[11px] tracking-wide ${isActive ? 'font-bold text-[#13C296]' : (isDarkMode ? 'font-medium text-gray-400' : 'font-medium text-gray-600')}`}>
                    {type.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-1.5">
          <label className={`text-[11px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            Formula
          </label>
          <textarea
            value={formula}
            onChange={e => { setFormula(e.target.value); setError(null); }}
            placeholder="e.g. {salary} * 0.15"
            rows={3}
            className={`w-full px-3 py-2 text-[13px] rounded-lg border focus:ring-2 focus:ring-[#13C296]/20 outline-none transition-all font-mono
              ${isDarkMode ? 'bg-black/20 border-gray-700 focus:border-[#13C296]' : 'bg-white border-gray-300 focus:border-[#13C296]'}`}
          />
          <div className="mt-2.5 flex flex-col gap-1.5">
            <span className={`text-[11px] font-medium ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
              Standard math and logic functions supported.
            </span>
            <a 
              href="/instructions" 
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] font-bold text-[#13C296] hover:underline w-fit"
            >
              READ FULL INSTRUCTIONS <ArrowRight className="w-3 h-3" strokeWidth={3} />
            </a>
          </div>
        </div>

        <div className="space-y-2 flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between flex-shrink-0 gap-2">
            <label className={`text-[11px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              Insert Column Variable
            </label>
            <div className="relative">
              <Search className={`absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`} />
              <input 
                type="text"
                placeholder="Search variables..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className={`pl-7 pr-2 py-1.5 text-[11px] rounded-md border outline-none transition-colors w-[150px]
                  ${isDarkMode ? 'bg-black/20 border-gray-700 focus:border-[#13C296] text-gray-300' : 'bg-white border-gray-300 focus:border-[#13C296] text-gray-700'}`}
              />
            </div>
          </div>
          <div className="max-h-[240px] overflow-y-auto custom-scrollbar pr-2 -mr-2 mt-1">
            <div className="flex flex-wrap gap-2 pb-1">
              {(!searchQuery || 'today()'.includes(searchQuery.toLowerCase())) && (
                <button
                  onClick={() => setFormula((prev: string) => prev + (prev.endsWith(' ') || prev.length === 0 ? '' : ' ') + 'TODAY() ')}
                  className={`text-[11px] font-bold px-2.5 py-1.5 rounded-md border transition-colors shadow-sm
                    ${isDarkMode ? 'border-indigo-500/30 text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20' : 'border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100'}`}
                >
                  TODAY()
                </button>
              )}
              {(!searchQuery || 'now()'.includes(searchQuery.toLowerCase())) && (
                <button
                  onClick={() => setFormula((prev: string) => prev + (prev.endsWith(' ') || prev.length === 0 ? '' : ' ') + 'NOW() ')}
                  className={`text-[11px] font-bold px-2.5 py-1.5 rounded-md border transition-colors shadow-sm
                    ${isDarkMode ? 'border-violet-500/30 text-violet-400 bg-violet-500/10 hover:bg-violet-500/20' : 'border-violet-200 text-violet-700 bg-violet-50 hover:bg-violet-100'}`}
                >
                  NOW()
                </button>
              )}
              
              {formulaColumns.map(col => (
                <button
                  key={col.key}
                  onClick={() => insertVariable(col.key)}
                  className={`text-[11px] font-medium px-2.5 py-1.5 rounded-md border transition-colors
                    ${isDarkMode ? 'border-gray-700 text-gray-300 hover:bg-white/10' : 'border-gray-200 text-gray-700 hover:bg-gray-100'}`}
                >
                  {col.label}
                </button>
              ))}
              
              {formulaColumns.length === 0 && searchQuery && !'today()'.includes(searchQuery.toLowerCase()) && !'now()'.includes(searchQuery.toLowerCase()) && (
                <span className={`text-[11px] py-1.5 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>No variables match your search</span>
              )}
              {formulaColumns.length === 0 && !searchQuery && (
                <span className={`text-[11px] py-1.5 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>No valid columns available</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className={`p-4 border-t flex items-center justify-between ${isDarkMode ? 'border-[#13C296]/20' : 'border-gray-100'}`}>
        <span className={`text-[11px] font-medium ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
          {name.trim() && formula.trim() ? 'Ready to save' : 'Complete fields to save'}
        </span>
        <button
          onClick={handleSave}
          disabled={!name.trim() || !formula.trim()}
          className={`px-5 py-2 rounded-xl text-[13px] font-bold transition-colors shadow-sm
            ${name.trim() && formula.trim()
              ? 'bg-[#13C296] hover:bg-[#0f9f7a] text-white'
              : (isDarkMode ? 'bg-gray-800 text-gray-600 cursor-not-allowed' : 'bg-gray-100 text-gray-400 cursor-not-allowed')}`}
        >
          {editingKey ? 'Save Changes' : 'Create Formula'}
        </button>
      </div>

      {/* Live preview in center of screen */}
      {(name.trim() || formula.trim()) && createPortal(
        <div className="fixed inset-0 z-[9995] flex items-center justify-center pointer-events-none pr-[400px]">
          <div className="flex flex-col items-center gap-4">
            <span className={`text-[13px] font-bold tracking-widest uppercase opacity-50 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Live Preview</span>
            
            <div className={`p-8 rounded-3xl shadow-2xl min-w-[300px] max-w-[500px] border transform scale-125 pointer-events-auto
              ${isDarkMode ? 'bg-[#0B1E19] border-[#13C296]/30 shadow-black/80' : 'bg-white border-gray-200 shadow-xl'}`}>
              <CellRenderer 
                value={null}
                row={rows?.[previewRowIndex] || { rowId: 'empty', values: {} }} 
                column={{
                  key: 'preview',
                  label: name || 'Preview',
                  dataType: 'formula',
                  formula: formula,
                  resultType: resultType,
                  order: 999,
                  visible: true,
                  pinned: null,
                  width: 150,
                  editable: false
                }}
                allColumns={columns}
                isDarkMode={isDarkMode} 
              />
            </div>

            {rows && rows.length > 0 && (
              <div className={`mt-6 flex items-center gap-4 px-4 py-1.5 rounded-full pointer-events-auto border backdrop-blur-md
                ${isDarkMode ? 'bg-black/40 border-gray-700' : 'bg-white/80 border-gray-200 shadow-sm'}`}>
                <button 
                  onClick={() => setPreviewRowIndex(v => Math.max(0, v - 1))}
                  disabled={previewRowIndex === 0}
                  className={`p-1 rounded-full transition-colors ${previewRowIndex === 0 ? 'opacity-30' : (isDarkMode ? 'hover:bg-white/10' : 'hover:bg-gray-100')}`}
                >
                  <ChevronLeft className={`w-4 h-4 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`} />
                </button>
                <span className={`text-[12px] font-bold ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  Row {previewRowIndex + 1} of {rows.length}
                </span>
                <button 
                  onClick={() => setPreviewRowIndex(v => Math.min(rows.length - 1, v + 1))}
                  disabled={previewRowIndex === rows.length - 1}
                  className={`p-1 rounded-full transition-colors ${previewRowIndex === rows.length - 1 ? 'opacity-30' : (isDarkMode ? 'hover:bg-white/10' : 'hover:bg-gray-100')}`}
                >
                  <ChevronRight className={`w-4 h-4 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`} />
                </button>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
