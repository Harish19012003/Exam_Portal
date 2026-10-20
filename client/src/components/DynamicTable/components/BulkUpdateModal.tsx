import { useState, useRef, useEffect, useMemo } from 'react';
import { X, Layers, Search, Type, Hash, ToggleLeft, List, Check } from 'lucide-react';
import type { ColumnConfig, FieldColumn } from '../types';

interface BulkUpdateModalProps {
  columns: ColumnConfig[];
  selectedCount: number;
  onApply: (updates: Record<string, unknown>) => void;
  onClose: () => void;
  isDarkMode: boolean;
}

export function BulkUpdateModal({ columns, selectedCount, onApply, onClose, isDarkMode }: BulkUpdateModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  
  // Filter for editable field columns only
  const editableColumns = columns.filter(c => c.dataType !== 'composite' && c.editable !== false) as FieldColumn[];
  
  const [enabledFields, setEnabledFields] = useState<Set<string>>(new Set());
  const [updates, setUpdates] = useState<Record<string, unknown>>({});
  const [searchQuery, setSearchQuery] = useState('');

  const filteredColumns = useMemo(() => {
    if (!searchQuery.trim()) return editableColumns;
    const q = searchQuery.toLowerCase();
    return editableColumns.filter(c => c.label.toLowerCase().includes(q));
  }, [editableColumns, searchQuery]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const handleToggleField = (colKey: string, isEnabled: boolean) => {
    setEnabledFields(prev => {
      const next = new Set(prev);
      if (isEnabled) {
        next.add(colKey);
        setUpdates(u => {
          if (colKey in u) return u;
          const col = editableColumns.find(c => c.key === colKey);
          let defaultVal: unknown = '';
          if (col) {
            if (col.dataType === 'boolean') defaultVal = false;
            else if (col.dataType === 'status' || col.dataType === 'dropdown') defaultVal = col.options?.[0] || '';
          }
          return { ...u, [colKey]: defaultVal };
        });
      } else {
        next.delete(colKey);
      }
      return next;
    });
  };

  const handleValueChange = (colKey: string, val: unknown) => {
    setUpdates(prev => ({ ...prev, [colKey]: val }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (enabledFields.size === 0) return;
    
    const finalUpdates: Record<string, unknown> = {};
    enabledFields.forEach(key => {
      finalUpdates[key] = updates[key];
    });
    
    onApply(finalUpdates);
  };

  const getDataTypeIcon = (type: string) => {
    switch (type) {
      case 'number':
      case 'currency': return <Hash className="w-3.5 h-3.5" />;
      case 'boolean': return <ToggleLeft className="w-3.5 h-3.5" />;
      case 'dropdown':
      case 'status': return <List className="w-3.5 h-3.5" />;
      default: return <Type className="w-3.5 h-3.5" />;
    }
  };

  const renderInput = (col: FieldColumn) => {
    const value = updates[col.key] ?? '';
    const inputCls = `w-full px-3 py-2 text-[13px] font-medium outline-none rounded-lg border focus:ring-2 focus:ring-[#13C296]/20 transition-all shadow-sm
      ${isDarkMode 
        ? 'bg-gray-900 border-gray-700 text-gray-100 focus:border-[#13C296]' 
        : 'bg-white border-gray-200 text-gray-900 focus:border-[#13C296]'}`;

    switch (col.dataType) {
      case 'boolean':
        return (
          <div className="pt-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <div className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${value ? 'bg-[#13C296]' : isDarkMode ? 'bg-gray-700' : 'bg-gray-300'}`}>
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={Boolean(value)}
                  onChange={e => handleValueChange(col.key, e.target.checked)}
                />
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${value ? 'translate-x-4' : 'translate-x-1'}`} />
              </div>
              <span className={`text-[13px] font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                {value ? 'True / Enabled' : 'False / Disabled'}
              </span>
            </label>
          </div>
        );
      
      case 'dropdown':
      case 'status':
        return (
          <select
            value={String(value)}
            onChange={e => handleValueChange(col.key, e.target.value)}
            className={inputCls}
          >
            {col.options?.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        );

      case 'number':
      case 'currency':
        return (
          <input
            type="number"
            value={String(value)}
            onChange={e => handleValueChange(col.key, Number(e.target.value))}
            className={inputCls}
            placeholder={`Enter new ${col.label.toLowerCase()}...`}
          />
        );

      default:
        return (
          <input
            type="text"
            value={String(value)}
            onChange={e => handleValueChange(col.key, e.target.value)}
            className={inputCls}
            placeholder={`Enter new ${col.label.toLowerCase()}...`}
          />
        );
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
      <div 
        ref={modalRef}
        className={`w-full max-w-[540px] max-h-[85vh] flex flex-col rounded-2xl shadow-2xl border animate-[slideUp_0.2s_ease-out] overflow-hidden
          ${isDarkMode ? 'bg-gray-900 border-gray-800' : 'bg-gray-50 border-gray-200'}`}
      >
        {/* Header */}
        <div className={`flex flex-col px-5 py-4 border-b flex-shrink-0 ${isDarkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-100'}`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm border ${isDarkMode ? 'bg-indigo-900/40 border-indigo-800/50' : 'bg-indigo-50 border-indigo-100'}`}>
                <Layers className={`w-5 h-5 ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`} />
              </div>
              <div>
                <h3 className={`text-base font-bold ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>Mass Edit Fields</h3>
                <p className={`text-[12px] font-medium mt-0.5 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  Applying changes to <strong className={isDarkMode ? 'text-gray-200' : 'text-gray-800'}>{selectedCount} selected rows</strong>
                </p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className={`p-2 rounded-xl transition-colors ${isDarkMode ? 'text-gray-400 hover:bg-gray-800' : 'text-gray-500 hover:bg-gray-100'}`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Search Bar */}
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors focus-within:ring-2 focus-within:ring-[#13C296]/20 focus-within:border-[#13C296]
            ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
            <Search className={`w-4 h-4 flex-shrink-0 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`} />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search fields to update..."
              className={`flex-1 text-[13px] font-medium bg-transparent outline-none ${isDarkMode ? 'text-gray-200 placeholder-gray-500' : 'text-gray-800 placeholder-gray-400'}`}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className={isDarkMode ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'}>
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className={`flex-1 overflow-y-auto p-2 ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
            
            {filteredColumns.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-center">
                <Search className={`w-8 h-8 mb-3 ${isDarkMode ? 'text-gray-700' : 'text-gray-300'}`} />
                <p className={`text-[13px] font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>No fields match your search.</p>
              </div>
            ) : (
              <div className="space-y-2 p-2">
                {filteredColumns.map(col => {
                  const isEnabled = enabledFields.has(col.key);
                  return (
                    <div 
                      key={col.key} 
                      className={`flex flex-col rounded-xl border transition-all duration-200 overflow-hidden group
                        ${isEnabled 
                          ? (isDarkMode ? 'bg-gray-800/80 border-[#13C296]/50 shadow-[0_4px_12px_rgba(19,194,150,0.1)]' : 'bg-white border-[#13C296] shadow-[0_4px_12px_rgba(19,194,150,0.08)] ring-1 ring-[#13C296]/20')
                          : (isDarkMode ? 'bg-gray-800/30 border-gray-800 hover:border-gray-700 hover:bg-gray-800/60' : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm')
                        }`}
                    >
                      {/* Field Row Header */}
                      <div 
                        className="flex items-center gap-3.5 p-3.5 cursor-pointer select-none"
                        onClick={() => handleToggleField(col.key, !isEnabled)}
                      >
                        <div className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0 shadow-inner ${isEnabled ? 'bg-[#13C296]' : isDarkMode ? 'bg-gray-700' : 'bg-gray-300 group-hover:bg-gray-400'}`}>
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${isEnabled ? 'translate-x-[18px]' : 'translate-x-[2px]'}`} />
                        </div>
                        
                        <div className={`flex items-center justify-center w-7 h-7 rounded-lg transition-colors ${isEnabled ? (isDarkMode ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-700') : (isDarkMode ? 'bg-gray-800 text-gray-500' : 'bg-gray-100 text-gray-400 group-hover:text-gray-600 group-hover:bg-gray-200')}`}>
                          {getDataTypeIcon(col.dataType)}
                        </div>

                        <span className={`text-[13px] font-bold tracking-wide flex-1 transition-colors ${isEnabled ? (isDarkMode ? 'text-gray-200' : 'text-gray-900') : (isDarkMode ? 'text-gray-400 group-hover:text-gray-300' : 'text-gray-600 group-hover:text-gray-900')}`}>
                          {col.label}
                        </span>
                      </div>

                      {/* Expandable Input Area */}
                      {isEnabled && (
                        <div className={`px-4 pb-4 pt-1 animate-[slideDown_0.2s_ease-out] ${isDarkMode ? 'bg-gray-800/50' : 'bg-gray-50/80 rounded-b-xl'}`}>
                          <div className={`h-px w-full mb-3 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}`} />

                          <div onClick={e => e.stopPropagation()}>
                            {renderInput(col)}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className={`p-4 flex items-center justify-between border-t flex-shrink-0 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.05)]
            ${isDarkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
            <span className={`text-[12px] font-medium px-2 py-1 rounded-md ${isDarkMode ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-600'}`}>
              <strong className={isDarkMode ? 'text-gray-200' : 'text-gray-900'}>{enabledFields.size}</strong> field{enabledFields.size !== 1 ? 's' : ''} to update
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className={`px-4 py-2 rounded-xl text-[13px] font-bold transition-colors border
                  ${isDarkMode ? 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={enabledFields.size === 0}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-bold transition-all bg-[#13C296] hover:bg-[#0f9f7a] text-white disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-[#13C296]/20"
              >
                <Check className="w-4 h-4" />
                Apply to {selectedCount} rows
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
