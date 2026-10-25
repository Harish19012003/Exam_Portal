import { useState, useMemo, useEffect, type DragEvent } from 'react';
import { createPortal } from 'react-dom';
import { X, Eye, EyeOff, Plus, GripVertical, ChevronLeft, ChevronRight, Trash2, Paintbrush } from 'lucide-react';
import { TitleCombobox } from './TitleCombobox';
import { RoleCombobox } from './RoleCombobox';
import { FieldCombobox } from './FieldCombobox';
import { CompositeCell } from '../renderers';
import { FormulaBuilder } from './FormulaBuilder';
import { ConditionalFormatBuilder } from './ConditionalFormatBuilder';
import type { ColumnConfig, CompositeColumnDef, CompositeRole, ConditionalFormatRule, DataRow } from '../types';
import { isFieldColumn, isCompositeColumn } from '../types';

interface SidebarManagerProps {
  columns: ColumnConfig[];
  columnOrder: string[];
  columnVisibility: Record<string, boolean>;
  rows?: DataRow[];
  onToggleVisibility: (key: string) => void;
  onReorderColumn: (fromKey: string, toKey: string) => void;
  onAddComposite: (col: ColumnConfig) => void;
  onUpdateComposite: (oldKey: string, col: ColumnConfig) => void;
  onUpdateColumnProp: (colKey: string, prop: string, value: unknown) => void;
  onAddFormula: (col: ColumnConfig) => void;
  onUpdateFormula: (oldKey: string, col: ColumnConfig) => void;
  conditionalFormats: ConditionalFormatRule[];
  recentFormatColors: string[];
  onAddConditionalFormat: (rule: ConditionalFormatRule) => void;
  onUpdateConditionalFormat: (rule: ConditionalFormatRule) => void;
  onDeleteConditionalFormat: (id: string) => void;
  onToggleConditionalFormat: (id: string) => void;
  onPushRecentFormatColor: (hex: string) => void;
  onClose: () => void;
  isDarkMode: boolean;
  canSaveLayoutAsDefault?: boolean;
  hasUserLayoutOverride?: boolean;
  onSaveLayoutAsDefault?: () => void | Promise<void>;
  onResetLayoutToDefault?: () => void | Promise<void>;
}

export function SidebarManager({
  columns,
  columnOrder,
  columnVisibility,
  rows,
  onToggleVisibility,
  onReorderColumn,
  onAddComposite,
  onUpdateComposite,
  onUpdateColumnProp,
  onAddFormula,
  onUpdateFormula,
  conditionalFormats,
  recentFormatColors,
  onAddConditionalFormat,
  onUpdateConditionalFormat,
  onDeleteConditionalFormat,
  onToggleConditionalFormat,
  onPushRecentFormatColor,
  onClose,
  isDarkMode,
  canSaveLayoutAsDefault = false,
  hasUserLayoutOverride = false,
  onSaveLayoutAsDefault,
  onResetLayoutToDefault,
}: SidebarManagerProps) {
  const [view, setView] = useState<'list' | 'edit' | 'formula' | 'format'>('list');
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editingFormatId, setEditingFormatId] = useState<string | null>(null);
  const [isAnimatingIn, setIsAnimatingIn] = useState(false);

  useEffect(() => {
    // Trigger animation on next tick after mount
    requestAnimationFrame(() => {
      setIsAnimatingIn(true);
    });
  }, []);

  const handleClose = () => {
    setIsAnimatingIn(false);
    setTimeout(onClose, 300); // Wait for exit transition (300ms)
  };

  const handleEdit = (key: string) => {
    const col = columns.find(c => c.key === key);
    setEditingKey(key);
    if (col?.dataType === 'formula') {
      setView('formula');
    } else {
      setView('edit');
    }
  };

  const handleCreate = () => {
    setEditingKey(null);
    setView('edit');
  };

  const handleCreateFormula = () => {
    setEditingKey(null);
    setView('formula');
  };

  const handleCreateFormat = () => {
    setEditingFormatId(null);
    setView('format');
  };

  const handleEditFormat = (id: string) => {
    setEditingFormatId(id);
    setView('format');
  };

  const handleBack = () => {
    setView('list');
    setEditingKey(null);
    setEditingFormatId(null);
  };

  const isDetailView = view === 'edit' || view === 'formula' || view === 'format';
  const headerTitle =
    view === 'list'
      ? 'Manage Columns'
      : view === 'formula'
        ? editingKey
          ? 'Edit Formula'
          : 'Create Formula'
        : view === 'format'
          ? editingFormatId
            ? 'Edit Formatting'
            : 'Conditional Formatting'
          : editingKey
            ? 'Edit Group'
            : 'Create Group';
  const editingFormatRule = editingFormatId
    ? conditionalFormats.find(r => r.id === editingFormatId) ?? null
    : null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 z-[9990] transition-opacity duration-300 ${isAnimatingIn ? 'opacity-100' : 'opacity-0'} ${isDetailView ? 'bg-black/15' : 'bg-transparent'}`} 
        onClick={view === 'list' ? handleClose : undefined}
      />
      
      {/* Sidebar */}
      <div
        className={`fixed right-0 top-0 bottom-0 z-[9999] w-[400px] flex flex-col shadow-2xl transition-transform duration-300 ease-in-out border-l
          ${isAnimatingIn ? 'translate-x-0' : 'translate-x-full'}
          ${isDarkMode ? 'bg-[#0B1E19] border-[#13C296]/20' : 'bg-white border-gray-200'}`}
        role="dialog"
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-4 border-b flex-shrink-0 ${isDarkMode ? 'border-[#13C296]/20' : 'border-gray-100'}`}>
          <div className="flex items-center gap-3">
            <div className={`overflow-hidden transition-all duration-300 ${view !== 'list' ? 'w-7 opacity-100' : 'w-0 opacity-0'}`}>
              <button
                onClick={handleBack}
                className={`p-1 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            </div>
            <div>
              <h2 className={`text-[15px] font-bold ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                {headerTitle}
              </h2>
            </div>
          </div>
          <button
            onClick={handleClose}
            className={`p-1.5 rounded-lg transition-colors
              ${isDarkMode ? 'text-gray-400 hover:text-gray-200 hover:bg-white/10' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'}`}
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {view === 'list' && (
            <ListView 
              columns={columns}
              columnOrder={columnOrder}
              columnVisibility={columnVisibility}
              conditionalFormats={conditionalFormats}
              onToggleVisibility={onToggleVisibility}
              onReorderColumn={onReorderColumn}
              onCreateGroup={handleCreate}
              onCreateFormula={handleCreateFormula}
              onCreateFormat={handleCreateFormat}
              onEditFormat={handleEditFormat}
              onDeleteFormat={onDeleteConditionalFormat}
              onToggleFormat={onToggleConditionalFormat}
              onEditGroup={handleEdit}
              onUpdateColumnProp={onUpdateColumnProp}
              isDarkMode={isDarkMode}
              canSaveLayoutAsDefault={canSaveLayoutAsDefault}
              hasUserLayoutOverride={hasUserLayoutOverride}
              onSaveLayoutAsDefault={onSaveLayoutAsDefault}
              onResetLayoutToDefault={onResetLayoutToDefault}
            />
          )}
          
          {view === 'edit' && (
            <EditView 
              columns={columns}
              editingKey={editingKey}
              rows={rows}
              onSave={(newCol) => {
                if (editingKey) onUpdateComposite(editingKey, newCol);
                else onAddComposite(newCol);
                handleBack();
              }}
              isDarkMode={isDarkMode}
            />
          )}
          
          {view === 'formula' && (
            <FormulaBuilder 
              columns={columns}
              editingKey={editingKey}
              rows={rows}
              onSave={(newCol) => {
                if (editingKey) {
                  onUpdateFormula(editingKey, newCol);
                } else {
                  onAddFormula(newCol);
                }
                handleBack();
              }}
              onCancel={handleBack}
              isDarkMode={isDarkMode}
            />
          )}

          {view === 'format' && (
            <ConditionalFormatBuilder
              columns={columns}
              rows={rows}
              editingRule={editingFormatRule}
              recentColors={recentFormatColors}
              onPushRecentColor={onPushRecentFormatColor}
              onSave={rule => {
                if (editingFormatId) onUpdateConditionalFormat(rule);
                else onAddConditionalFormat(rule);
                handleBack();
              }}
              onCancel={handleBack}
              isDarkMode={isDarkMode}
            />
          )}
        </div>
      </div>
    </>
  );
}

// ── List View ─────────────────────────────────────────────────────────────

interface ListViewProps {
  columns: ColumnConfig[];
  columnOrder: string[];
  columnVisibility: Record<string, boolean>;
  conditionalFormats: ConditionalFormatRule[];
  onToggleVisibility: (key: string) => void;
  onReorderColumn: (fromKey: string, toKey: string) => void;
  onCreateGroup: () => void;
  onCreateFormula: () => void;
  onCreateFormat: () => void;
  onEditFormat: (id: string) => void;
  onDeleteFormat: (id: string) => void;
  onToggleFormat: (id: string) => void;
  onEditGroup: (key: string) => void;
  onUpdateColumnProp: (colKey: string, prop: string, value: unknown) => void;
  isDarkMode: boolean;
  canSaveLayoutAsDefault?: boolean;
  hasUserLayoutOverride?: boolean;
  onSaveLayoutAsDefault?: () => void | Promise<void>;
  onResetLayoutToDefault?: () => void | Promise<void>;
}

function ListView({
  columns,
  columnOrder,
  columnVisibility,
  conditionalFormats,
  onToggleVisibility,
  onReorderColumn,
  onCreateGroup,
  onCreateFormula,
  onCreateFormat,
  onEditFormat,
  onDeleteFormat,
  onToggleFormat,
  onEditGroup,
  onUpdateColumnProp,
  isDarkMode,
  canSaveLayoutAsDefault = false,
  hasUserLayoutOverride = false,
  onSaveLayoutAsDefault,
  onResetLayoutToDefault,
}: ListViewProps) {
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [layoutBusy, setLayoutBusy] = useState(false);

  const runLayoutAction = async (fn?: () => void | Promise<void>) => {
    if (!fn || layoutBusy) return;
    setLayoutBusy(true);
    try {
      await fn();
    } finally {
      setLayoutBusy(false);
    }
  };

  const orderedColumns = columnOrder
    .map(key => columns.find(c => c.key === key))
    .filter(Boolean) as ColumnConfig[];

  const handleDragStart = (e: DragEvent, key: string) => {
    setDragKey(key);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', key);
  };

  const handleDragOver = (e: DragEvent, _key: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: DragEvent, targetKey: string) => {
    e.preventDefault();
    const sourceKey = dragKey;
    if (sourceKey && sourceKey !== targetKey) {
      onReorderColumn(sourceKey, targetKey);
    }
    setDragKey(null);
  };

  const ruleSummary = (rule: ConditionalFormatRule) => {
    if (rule.name) return rule.name;
    if (rule.conditionMode === 'formula') {
      return rule.conditionFormula?.slice(0, 40) || 'Formula rule';
    }
    const col = columns.find(c => c.key === rule.whenColumnKey);
    return `${col?.label ?? rule.whenColumnKey} ${rule.op ?? ''} ${rule.value ?? ''}`.trim();
  };

  return (
    <div className="flex flex-col h-full">
      <div className={`p-4 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
        <h3 className={`text-sm font-semibold mb-3 ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
          Visible Columns ({orderedColumns.filter(c => columnVisibility[c.key] !== false).length}/{columns.length})
        </h3>
        <div className="flex gap-2">
          <button
            onClick={onCreateGroup}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border border-dashed transition-colors
              ${isDarkMode 
                ? 'border-gray-600 hover:border-[#13C296] text-gray-400 hover:text-[#13C296] hover:bg-[#13C296]/5' 
                : 'border-gray-300 hover:border-[#13C296] text-gray-500 hover:text-[#13C296] hover:bg-[#13C296]/5'}`}
          >
            <Plus className="w-4 h-4" />
            <span className="text-sm font-medium">Create Group</span>
          </button>
          <button
            onClick={onCreateFormula}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border border-dashed transition-colors
              ${isDarkMode 
                ? 'border-gray-600 hover:border-[#13C296] text-gray-400 hover:text-[#13C296] hover:bg-[#13C296]/5' 
                : 'border-gray-300 hover:border-[#13C296] text-gray-500 hover:text-[#13C296] hover:bg-[#13C296]/5'}`}
          >
            <Plus className="w-4 h-4" />
            <span className="text-sm font-medium">Create Formula</span>
          </button>
        </div>
        <button
          onClick={onCreateFormat}
          className={`mt-2 w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-dashed transition-colors
            ${isDarkMode 
              ? 'border-gray-600 hover:border-[#13C296] text-gray-400 hover:text-[#13C296] hover:bg-[#13C296]/5' 
              : 'border-gray-300 hover:border-[#13C296] text-gray-500 hover:text-[#13C296] hover:bg-[#13C296]/5'}`}
        >
          <Paintbrush className="w-4 h-4" />
          <span className="text-sm font-medium">Conditional formatting</span>
        </button>

        {conditionalFormats.length > 0 && (
          <div className="mt-3 space-y-1.5">
            <div className={`text-[11px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
              Format rules ({conditionalFormats.length})
            </div>
            {conditionalFormats.map(rule => (
              <div
                key={rule.id}
                className={`flex items-center gap-2 px-2 py-1.5 rounded-lg group
                  ${isDarkMode ? 'hover:bg-white/5' : 'hover:bg-gray-50'}`}
              >
                <button
                  type="button"
                  onClick={() => onToggleFormat(rule.id)}
                  className={`w-2.5 h-2.5 rounded-full flex-shrink-0 border
                    ${rule.enabled
                      ? 'bg-[#13C296] border-[#13C296]'
                      : isDarkMode
                        ? 'bg-transparent border-gray-600'
                        : 'bg-transparent border-gray-300'}`}
                  title={rule.enabled ? 'Disable' : 'Enable'}
                />
                <button
                  type="button"
                  onClick={() => onEditFormat(rule.id)}
                  className={`flex-1 min-w-0 text-left text-[12px] truncate
                    ${rule.enabled
                      ? isDarkMode ? 'text-gray-200' : 'text-gray-700'
                      : isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}
                >
                  <span className="inline-flex items-center gap-1.5 max-w-full">
                    {(rule.style.backgroundColor || rule.style.color) && (
                      <span
                        className={`inline-block w-3 h-3 rounded-sm border flex-shrink-0 ${isDarkMode ? 'border-white/20' : 'border-gray-300'}`}
                        style={{
                          backgroundColor: rule.style.backgroundColor || 'transparent',
                          boxShadow: rule.style.color ? `inset 0 0 0 1px ${rule.style.color}` : undefined,
                        }}
                      />
                    )}
                    <span className="truncate">{ruleSummary(rule)}</span>
                    <span className={`text-[10px] flex-shrink-0 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                      · {rule.scope === 'row' ? 'row' : 'cell'}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteFormat(rule.id)}
                  className={`p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity
                    ${isDarkMode ? 'text-gray-500 hover:text-red-400' : 'text-gray-400 hover:text-red-500'}`}
                  aria-label="Delete rule"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-4">
        {orderedColumns.map(col => {
          const isVisible = columnVisibility[col.key] !== false;
          const isGroup = col.dataType === 'composite';
          const isDragging = dragKey === col.key;

          return (
            <div
              key={col.key}
              draggable
              onDragStart={(e) => handleDragStart(e, col.key)}
              onDragOver={(e) => handleDragOver(e, col.key)}
              onDrop={(e) => handleDrop(e, col.key)}
              onDragEnd={() => setDragKey(null)}
              className={`flex items-center justify-between p-2 mb-1 rounded-lg transition-all
                ${isDragging ? 'opacity-40 scale-[0.98]' : 'opacity-100 scale-100'}
                ${isDarkMode ? 'hover:bg-white/5' : 'hover:bg-gray-50'}`}
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <button
                  className={`p-1 cursor-grab active:cursor-grabbing rounded ${isDarkMode ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  <GripVertical className="w-4 h-4" />
                </button>
                
                <button
                  onClick={() => onToggleVisibility(col.key)}
                  className={`w-6 h-6 rounded flex items-center justify-center flex-shrink-0 transition-all duration-300 ease-out active:scale-75
                    ${isVisible
                      ? 'bg-[#13C296] text-white'
                      : (isDarkMode ? 'bg-black/20 border border-gray-700 text-gray-600' : 'bg-gray-100 border border-gray-200 text-gray-400')}`}
                  aria-label={`${isVisible ? 'Hide' : 'Show'} ${col.label}`}
                >
                  {isVisible ? <Eye className="w-3.5 h-3.5 transition-transform duration-300 scale-100" /> : <EyeOff className="w-3.5 h-3.5 transition-transform duration-300 scale-90 opacity-70" />}
                </button>

                <div className="flex-1 min-w-0 flex items-center gap-2">
                  <span className={`text-[13px] font-medium truncate ${isVisible ? (isDarkMode ? 'text-gray-200' : 'text-gray-800') : (isDarkMode ? 'text-gray-600' : 'text-gray-400')}`}>
                    {col.label}
                  </span>
                  {!isGroup && (
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider flex-shrink-0
                      ${isDarkMode ? 'bg-gray-800 text-gray-500' : 'bg-gray-100 text-gray-400'}`}>
                      {col.dataType}
                    </span>
                  )}
                  {isGroup && (
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider flex-shrink-0
                      ${isDarkMode ? 'bg-[#13C296]/20 text-[#13C296]' : 'bg-[#13C296]/10 text-[#13C296]'}`}>
                      Group
                    </span>
                  )}
                </div>
              </div>

              {(isGroup || col.dataType === 'formula') && (
                <button
                  onClick={() => onEditGroup(col.key)}
                  className={`text-[11px] font-bold px-3 py-1.5 rounded-lg border ml-2 transition-colors
                    ${isDarkMode ? 'border-gray-700 text-gray-300 hover:bg-white/5' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                >
                  Edit
                </button>
              )}

              {!isGroup && ['dropdown', 'multiselect', 'status'].includes(col.dataType) && (
                <div 
                  className={`flex items-center gap-2 ml-2 px-2 py-1 rounded-lg border transition-colors cursor-pointer select-none
                    ${isFieldColumn(col) && col.allowCustom ? (isDarkMode ? 'border-[#13C296]/30 bg-[#13C296]/10 text-[#13C296]' : 'border-[#13C296]/30 bg-[#13C296]/5 text-[#13C296]') : (isDarkMode ? 'border-gray-700 text-gray-400 hover:text-gray-300 hover:bg-white/5' : 'border-gray-200 text-gray-500 hover:text-gray-600 hover:bg-gray-50')}`}
                  onClick={() => onUpdateColumnProp(col.key, 'allowCustom', isFieldColumn(col) ? !col.allowCustom : false)}
                  title="Allow Custom Input"
                >
                  <span className="text-[10px] font-semibold whitespace-nowrap">Custom</span>
                  <div className={`w-6 h-3.5 rounded-full transition-colors relative flex-shrink-0
                    ${isFieldColumn(col) && col.allowCustom ? 'bg-[#13C296]' : isDarkMode ? 'bg-gray-600' : 'bg-gray-300'}`}>
                    <div className={`absolute top-[2px] left-[2px] w-2.5 h-2.5 rounded-full bg-white transition-transform shadow-sm
                      ${isFieldColumn(col) && col.allowCustom ? 'translate-x-[10px]' : 'translate-x-0'}`} />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {(canSaveLayoutAsDefault || (hasUserLayoutOverride && onResetLayoutToDefault)) && (
        <div className={`p-4 border-t flex flex-col gap-2 ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
          <p className={`text-[11px] leading-snug ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
            Layout for this table saves automatically. Super admins can publish it as the default for everyone.
          </p>
          {hasUserLayoutOverride && onResetLayoutToDefault && (
            <button
              type="button"
              disabled={layoutBusy}
              onClick={() => runLayoutAction(onResetLayoutToDefault)}
              className={`w-full min-h-[44px] px-3 py-2 rounded-lg text-sm font-medium border transition-colors
                ${isDarkMode
                  ? 'border-gray-600 text-gray-300 hover:bg-white/5 disabled:opacity-50'
                  : 'border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50'}`}
            >
              Reset to default layout
            </button>
          )}
          {canSaveLayoutAsDefault && onSaveLayoutAsDefault && (
            <button
              type="button"
              disabled={layoutBusy}
              onClick={() => runLayoutAction(onSaveLayoutAsDefault)}
              className={`w-full min-h-[44px] px-3 py-2 rounded-lg text-sm font-semibold transition-colors
                ${isDarkMode
                  ? 'bg-[#13C296] text-white hover:bg-[#10a87f] disabled:opacity-50'
                  : 'bg-[#13C296] text-white hover:bg-[#0ea978] disabled:opacity-50'}`}
            >
              Save as default for everyone
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Edit View (Group Builder) ─────────────────────────────────────────────

interface EditViewProps {
  columns: ColumnConfig[];
  editingKey: string | null;
  onSave: (col: ColumnConfig) => void;
  rows?: DataRow[];
  isDarkMode: boolean;
}

function EditView({ columns, editingKey, onSave, rows, isDarkMode }: EditViewProps) {
  const fieldColumns = useMemo(() => columns.filter(c => c.dataType !== 'composite'), [columns]);
  const titleSuggestions = useMemo(() => fieldColumns.map(c => c.label), [fieldColumns]);

  const targetCol = useMemo(() => editingKey ? columns.find(c => c.key === editingKey) : null, [editingKey, columns]);

  const [label, setLabel] = useState(targetCol?.label || '');
  const [previewRowIndex, setPreviewRowIndex] = useState(0);
  const [parts, setParts] = useState<{ field: string; role: CompositeRole }[]>(
    targetCol && isCompositeColumn(targetCol) ? [...(targetCol.composedOf || [])] : []
  );
  const [deletingIndex, setDeletingIndex] = useState<number | null>(null);

  const handleAddPart = () => setParts(prev => [...prev, { field: '', role: 'primary' }]);
  
  const handleRemovePart = (index: number) => {
    setDeletingIndex(index);
    setTimeout(() => {
      setParts(prev => prev.filter((_, i) => i !== index));
      setDeletingIndex(null);
    }, 200);
  };
  
  const handlePartChange = (index: number, key: 'field' | 'role', val: string) => {
    setParts(prev => prev.map((p, i) => i === index ? { ...p, [key]: val } : p));
  };

  const activeRoles = parts.filter(p => p.field).map(p => p.role);
  const duplicateRoles = activeRoles.filter((item, index) => activeRoles.indexOf(item) !== index);
  const hasDuplicates = duplicateRoles.length > 0;
  const duplicateRoleName = hasDuplicates ? duplicateRoles[0].charAt(0).toUpperCase() + duplicateRoles[0].slice(1) : '';

  const isValid = label.trim().length > 0 && parts.length > 0 && parts.every(p => p.field && p.role) && !hasDuplicates;

  const maxFields = Math.min(7, fieldColumns.length);
  const canAddMore = parts.length < maxFields;

  // Generate preview
  const previewCol: CompositeColumnDef = useMemo(() => ({
    key: 'preview',
    label: label || 'Preview',
    dataType: 'composite',
    width: 250,
    order: 0,
    visible: true,
    pinned: null,
    composedOf: parts.filter(p => p.field)
  }), [label, parts]);

  const previewRow: DataRow = useMemo(() => {
    const realRow = rows?.[previewRowIndex];
    const vals: Record<string, unknown> = {};
    parts.forEach((p, i) => {
      if (!p.field) return;
      if (realRow && realRow.values[p.field] !== undefined && realRow.values[p.field] !== '') {
        vals[p.field] = realRow.values[p.field];
      } else {
        if (p.role === 'avatar') vals[p.field] = `https://i.pravatar.cc/150?u=${i}`;
        else if (p.role === 'icon') vals[p.field] = 'US';
        else if (p.role === 'primary') vals[p.field] = 'Preview Text';
        else if (p.role === 'secondary') vals[p.field] = 'preview@example.com';
        else if (p.role === 'tertiary') vals[p.field] = 'Tertiary detail';
        else if (p.role === 'badge') vals[p.field] = 'Preview';
        else vals[p.field] = 'Demo';
      }
    });
    return { rowId: 'preview', version: 1, values: vals };
  }, [parts, rows, previewRowIndex]);

  const handleSave = () => {
    if (!isValid) return;
    const newKey = editingKey || `composite_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const newCol: CompositeColumnDef = {
      key: newKey,
      label: label.trim(),
      dataType: 'composite',
      width: targetCol ? targetCol.width : 280, // Keep old width if editing
      order: targetCol ? targetCol.order : 999,
      visible: true,
      pinned: targetCol?.pinned ?? null,
      composedOf: parts,
    };
    onSave(newCol);
  };

  const labelCls = `block text-[11px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`;
  const mutedCls = `text-[11px] ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`;

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-6">
        
        {/* Step 1 */}
        <div className="space-y-1.5">
          <div>
            <label className={labelCls}>Group Title</label>
            <p className={`${mutedCls}`}>Give this column a name</p>
          </div>
          <TitleCombobox
            value={label}
            onChange={setLabel}
            suggestions={titleSuggestions}
            isDarkMode={isDarkMode}
          />
        </div>

        {/* Step 2 */}
        <div className="space-y-1.5">
          <div>
            <label className={labelCls}>Fields &amp; Roles</label>
            <p className={`${mutedCls}`}>Select the fields to group and how they look.</p>
          </div>

          {parts.length === 0 && (
            <div className={`flex flex-col items-center justify-center py-6 rounded-xl border-2 border-dashed
              ${isDarkMode ? 'border-gray-700 text-gray-600' : 'border-gray-200 text-gray-400'}`}>
              <p className="text-[12px] font-medium mb-1">No fields yet</p>
              <p className={`text-[11px] ${mutedCls}`}>Click "+ Add field" to start</p>
            </div>
          )}

          <div className="flex flex-col gap-2">
            {parts.map((part, i) => {
              const isDuplicate = duplicateRoles.includes(part.role);
              const isDeleting = deletingIndex === i;
              
              return (
                <div
                  key={i}
                  className={`flex items-start gap-2 p-3 mb-2 rounded-xl border transition-all duration-200
                    ${isDeleting ? 'opacity-0 scale-95 translate-x-4' : 'opacity-100 scale-100 translate-x-0 animate-in fade-in slide-in-from-top-2'}
                    ${isDuplicate 
                      ? (isDarkMode ? 'bg-red-900/20 border-red-800' : 'bg-red-50 border-red-300')
                      : (isDarkMode ? 'bg-black/20 border-gray-700' : 'bg-gray-50 border-gray-200')}`}
                >
                <div className="flex-1 flex flex-col gap-2 min-w-0">
                  <FieldCombobox
                    value={part.field}
                    onChange={v => handlePartChange(i, 'field', v)}
                    fields={fieldColumns}
                    isDarkMode={isDarkMode}
                  />
                  
                  <RoleCombobox
                    value={part.role}
                    onChange={v => handlePartChange(i, 'role', v)}
                    isDarkMode={isDarkMode}
                  />
                </div>

                <button
                  onClick={() => handleRemovePart(i)}
                  className={`p-2 rounded-lg flex-shrink-0 transition-colors mt-0.5
                    ${isDarkMode ? 'text-gray-500 hover:text-red-400 hover:bg-red-900/20' : 'text-gray-400 hover:text-red-500 hover:bg-red-50'}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )})}
          </div>

          {canAddMore && (
            <button
              onClick={handleAddPart}
              className={`mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-bold transition-all active:scale-[0.98] border
                ${isDarkMode
                  ? 'border-gray-700 text-gray-400 hover:text-gray-200 hover:bg-white/5'
                  : 'border-gray-200 text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}
            >
              <Plus className="w-3.5 h-3.5" />
              Add field
            </button>
          )}
        </div>

        {/* Live preview in center of screen */}
        {parts.some(p => p.field) && createPortal(
          <div className="fixed inset-0 z-[9995] flex items-center justify-center pointer-events-none pr-[400px]">
            <div className="flex flex-col items-center gap-4">
              <span className={`text-[13px] font-bold tracking-widest uppercase opacity-50 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Live Preview</span>
              
              <div className={`p-8 rounded-3xl shadow-2xl min-w-[300px] max-w-[500px] border transform scale-125 pointer-events-auto
                ${isDarkMode ? 'bg-[#0B1E19] border-[#13C296]/30 shadow-black/80' : 'bg-white border-gray-200 shadow-xl'}`}>
                <CompositeCell column={previewCol} row={previewRow} allColumns={columns} isDarkMode={isDarkMode} />
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

      {/* Footer */}
      <div className={`p-4 border-t flex items-center justify-between ${isDarkMode ? 'border-[#13C296]/20' : 'border-gray-100'}`}>
        <span className={`text-[11px] font-medium ${hasDuplicates ? (isDarkMode ? 'text-red-400' : 'text-red-600') : mutedCls}`}>
          {hasDuplicates 
            ? `The "${duplicateRoleName}" role can only be used once.` 
            : (isValid ? 'Ready to save' : 'Complete fields to save')}
        </span>
        <button
          onClick={handleSave}
          disabled={!isValid}
          className={`px-5 py-2 rounded-xl text-[13px] font-bold transition-colors shadow-sm
            ${isValid
              ? 'bg-[#13C296] hover:bg-[#0f9f7a] text-white'
              : (isDarkMode ? 'bg-gray-800 text-gray-600 cursor-not-allowed' : 'bg-gray-100 text-gray-400 cursor-not-allowed')}`}
        >
          {editingKey ? 'Save Changes' : 'Create Group'}
        </button>
      </div>
    </div>
  );
}
