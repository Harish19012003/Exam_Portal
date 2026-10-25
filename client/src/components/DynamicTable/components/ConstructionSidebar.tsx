import { useEffect, useState, useRef, type ReactNode } from 'react';
import { Check, Palette, X, Table, SlidersHorizontal, Layers, Columns, GripVertical, Settings, ChevronDown, Plus, Trash2 } from 'lucide-react';
import {
  type FirstColumnElementKey,
} from '../hooks/useTableFeatureConfig';
import type { ColumnConfig, CustomIconElement, CustomRowActionButton, DetailViewMode, RowActionType, SummaryChipConfig, TableFeaturesConfig } from '../types';
import { getTableFeatureItemsForSection, FEATURE_SECTION_FIND, FEATURE_SECTION_SUMMARIZE, FEATURE_SECTION_CHROME, FEATURE_SECTION_INTERACT, FEATURE_SECTION_STRUCTURE } from '../../DynamicData/viewFeatures';
import type { FeatureScope } from '../../DynamicData/viewFeatures';
import { SummaryChipsEditor } from '../../DynamicData/SummaryChipsEditor';
import { QuickFiltersEditor } from '../../DynamicData/QuickFiltersEditor';
import { InfoTip, LabelWithInfo } from '../../DynamicData/RecordDesignSidebar';

interface CustomSelectOption {
  value: any;
  label: string;
}

const ROW_ACTION_SELECT_OPTIONS: CustomSelectOption[] = [
  { value: 'edit', label: 'Action: Inline Edit' },
  { value: 'delete', label: 'Action: Delete Row' },
  { value: 'share', label: 'Action: Share Link' },
  { value: 'open-modal', label: 'Action: Open Modal' },
  { value: 'sidebar-drawer', label: 'Action: Sidebar Drawer' },
  { value: 'copy-column-value', label: 'Action: Copy Value' },
];

const TRIGGER_ACTION_OPTIONS: CustomSelectOption[] = [
  { value: 'sidebar-drawer', label: 'Action: Sidebar Drawer' },
  { value: 'open-modal', label: 'Action: Open Modal Popup' },
  { value: 'copy-column-value', label: 'Action: Copy Column Value' },
  { value: 'filter-by-column', label: 'Action: Filter Column' },
  { value: 'sort-column', label: 'Action: Sort Column' },
  { value: 'page-redirect', label: 'Action: Page Redirect' },
  { value: 'inline-subtable', label: 'Action: Inline Sub-Table' },
];

const EXPANDER_ACTION_OPTIONS: CustomSelectOption[] = [
  { value: 'inline-subtable', label: 'Action: Inline Sub-Table' },
  { value: 'open-modal', label: 'Action: Open Modal Popup' },
  { value: 'sidebar-drawer', label: 'Action: Sidebar Drawer' },
  { value: 'page-redirect', label: 'Action: Page Redirect' },
];

function ActionSelect({
  value,
  options,
  onChange,
  isDarkMode,
}: {
  value: DetailViewMode;
  options: CustomSelectOption[];
  onChange: (val: DetailViewMode) => void;
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

  const currentOption = options.find(o => o.value === value) || options[0];

  return (
    <div className="relative flex-1" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className={`flex w-full items-center justify-between gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-all ${isOpen
            ? 'border-[#13C296] ring-2 ring-[#13C296]/20'
            : isDarkMode
              ? 'border-gray-700 bg-[#182d27] text-gray-200 hover:border-gray-600'
              : 'border-gray-300 bg-white text-gray-800 hover:border-gray-400'
          }`}
      >
        <span className="truncate">{currentOption.label}</span>
        <ChevronDown className={`h-3.5 w-3.5 text-gray-400 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180 text-[#13C296]' : ''}`} />
      </button>

      {isOpen && (
        <div
          className={`absolute left-0 top-full z-50 mt-1 w-full min-w-[190px] overflow-hidden rounded-xl border p-1 shadow-xl backdrop-blur-md transition-all ${isDarkMode
              ? 'border-gray-700 bg-[#182d27]/95 text-gray-200'
              : 'border-gray-200 bg-white/95 text-gray-800'
            }`}
        >
          {options.map(opt => {
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${isSelected
                    ? 'bg-[#13C296]/15 text-[#13C296] font-semibold'
                    : isDarkMode
                      ? 'hover:bg-gray-800/80 hover:text-white'
                      : 'hover:bg-gray-100 hover:text-gray-900'
                  }`}
              >
                <span>{opt.label}</span>
                {isSelected && <Check className="h-3.5 w-3.5 text-[#13C296]" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ColumnSelect({
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
    if (!col) return 'Select Column';
    return (col as any).label || (col as any).header || col.key;
  };

  return (
    <div className="relative flex-1" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className={`flex w-full items-center justify-between gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-all ${isOpen
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
          className={`absolute left-0 top-full z-50 mt-1 max-h-44 w-full min-w-[180px] overflow-y-auto custom-scrollbar rounded-xl border p-1 shadow-xl backdrop-blur-md transition-all ${isDarkMode
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
                className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${isSelected
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

function ActionColorButton({
  color,
  onChangeColor,
  isDarkMode,
}: {
  color: string;
  onChangeColor: (color: string) => void;
  isDarkMode: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const PRESET_COLORS_5X5 = [
    '#13C296', '#f43f5e', '#3b82f6', '#8b5cf6', '#f59e0b',
    '#10b981', '#6366f1', '#06b6d4', '#ec4899', '#e11d48',
    '#f97316', '#64748b', '#84cc16', '#a855f7', '#0ea5e9',
    '#14b8a6', '#f43f5e', '#d97706', '#0284c7', '#7c3aed',
    '#059669', '#dc2626', '#2563eb', '#9333ea', '#ca8a04',
  ];

  return (
    <div className="relative flex-shrink-0" ref={popoverRef}>
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        style={{ backgroundColor: color || '#13C296' }}
        className="w-4.5 h-4.5 rounded-full transition-all hover:scale-115 flex-shrink-0 cursor-pointer shadow-xs"
        title="Choose color"
      />

      {isOpen && (
        <div
          className={`absolute right-0 top-full z-50 mt-1.5 p-2 rounded-xl border shadow-xl backdrop-blur-md transition-all ${isDarkMode
              ? 'border-gray-700/80 bg-[#111c18]/95 text-white'
              : 'border-gray-200 bg-white/95 text-gray-900'
            }`}
        >
          {/* 5x5 Color Grid */}
          <div className="grid grid-cols-5 gap-1.5 w-max">
            {PRESET_COLORS_5X5.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => {
                  onChangeColor(c);
                  setIsOpen(false);
                }}
                style={{ backgroundColor: c }}
                className={`w-5 h-5 rounded-lg transition-transform hover:scale-115 flex items-center justify-center ${color.toLowerCase() === c.toLowerCase() ? 'scale-110 shadow-xs' : 'opacity-85 hover:opacity-100'
                  }`}
              >
                {color.toLowerCase() === c.toLowerCase() && <Check className="w-3 h-3 text-white stroke-[3]" />}
              </button>
            ))}
          </div>

          {/* Clean Hex Input Bar */}
          <div className="mt-2 pt-1.5 border-t border-dashed border-gray-700/30 flex items-center gap-1.5">
            <input
              type="color"
              value={color || '#13C296'}
              onChange={e => onChangeColor(e.target.value)}
              className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent p-0 flex-shrink-0"
            />
            <input
              type="text"
              value={color || '#13C296'}
              onChange={e => {
                if (/^#[0-9A-F]{6}$/i.test(e.target.value)) {
                  onChangeColor(e.target.value);
                }
              }}
              className={`w-20 rounded border px-1.5 py-0.5 text-[10px] font-mono font-semibold ${isDarkMode
                  ? 'border-gray-700 bg-gray-800 text-gray-200 focus:border-[#13C296]'
                  : 'border-gray-300 bg-gray-50 text-gray-800 focus:border-[#13C296]'
                }`}
            />
          </div>
        </div>
      )}
    </div>
  );
}

interface ConstructionSidebarProps {
  onClose: () => void;
  isDarkMode: boolean;
  columns?: ColumnConfig[];
  customIconElements?: CustomIconElement[];
  onAddCustomIconElement?: (presetAction?: DetailViewMode) => void;
  onRemoveCustomIconElement?: (id: string) => void;
  onUpdateCustomIconElement?: (id: string, updates: Partial<CustomIconElement>) => void;
  firstColOrder?: string[];
  onReorderFirstCol?: (newOrder: string[]) => void;
  onOpenIconPickerForElement?: (id: string) => void;
  enableTriggerIcon?: boolean;
  onToggleTriggerIcon?: () => void;
  orderedElementKeys?: FirstColumnElementKey[];
  onReorderFirstColumnElements?: (newOrder: FirstColumnElementKey[]) => void;
  customFeatures: TableFeaturesConfig;
  onToggleFeature: (key: keyof TableFeaturesConfig) => void;
  onUpdateSummaryChips?: (chips: SummaryChipConfig[]) => void;
  actionsAlwaysVisible: boolean;
  onToggleActionsAlwaysVisible: () => void;
  onOpenIconPicker: () => void;
  detailViewMode?: DetailViewMode;
  onDetailViewModeChange?: (mode: DetailViewMode) => void;
  customDetailIcon?: string;
  expanderIcon?: string;
  onOpenExpanderIconPicker?: () => void;
  expanderOperation?: DetailViewMode;
  onExpanderOperationChange?: (mode: DetailViewMode) => void;
  showSubRowCount?: boolean;
  onToggleSubRowCount?: () => void;
  customRowActionButtons?: CustomRowActionButton[];
  onAddCustomRowActionButton?: (presetAction?: RowActionType) => void;
  onRemoveCustomRowActionButton?: (id: string) => void;
  onUpdateCustomRowActionButton?: (id: string, updates: Partial<CustomRowActionButton>) => void;
  onOpenIconPickerForActionButton?: (id: string) => void;
  onOpenColorPickerForActionButton?: (id: string) => void;
  isTransposed?: boolean;
  onToggleTranspose?: () => void;
  /** Portal admin: persist Feature Builder to SQL for all members */
  onSaveFeatures?: () => void | Promise<void>;
  isSavingFeatures?: boolean;
  featuresDirty?: boolean;
  onPatchRowActions?: (patch: {
    showExplore?: boolean;
    showDuplicate?: boolean;
    showEdit?: boolean;
    showDelete?: boolean;
  }) => void;
}

function SectionLabel({ icon: Icon, children, isDarkMode }: { icon?: React.ElementType; children: ReactNode; isDarkMode: boolean }) {
  return (
    <div className={`mb-3 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
      {Icon && <Icon className="h-3.5 w-3.5 text-[#13C296]" />}
      <span>{children}</span>
    </div>
  );
}

function ToggleRow({
  label,
  isActive,
  onClick,
  isDarkMode,
  subtitle,
  scope,
}: {
  label: string;
  isActive: boolean;
  onClick: () => void;
  isDarkMode: boolean;
  subtitle?: string;
  scope?: FeatureScope;
}) {
  return (
    <div
      className={`flex w-full items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5 transition-all ${isActive
          ? isDarkMode
            ? 'border-[#13C296]/50 bg-[#13C296]/15 text-white shadow-2xs'
            : 'border-[#13C296]/40 bg-[#13C296]/10 text-gray-900 shadow-2xs'
          : isDarkMode
            ? 'border-gray-800 bg-gray-800/40 text-gray-400 hover:border-gray-700 hover:text-gray-300'
            : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-900'
        }`}
    >
      <button
        type="button"
        onClick={onClick}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <div
          className={`flex h-4.5 w-4.5 flex-shrink-0 items-center justify-center rounded-full transition-colors ${isActive ? 'bg-[#13C296] text-[#111c18]' : isDarkMode ? 'bg-gray-700' : 'bg-gray-200'
            }`}
        >
          {isActive && <Check className="h-3 w-3 stroke-[3]" />}
        </div>
        <span className="min-w-0 truncate text-[12.5px] font-medium leading-snug">{label}</span>
      </button>
      {scope ? (
        <span
          className={`flex-shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
            scope === 'shared'
              ? isDarkMode
                ? 'bg-[#13C296]/20 text-[#5eead4]'
                : 'bg-emerald-50 text-emerald-800 border border-emerald-200/80'
              : isDarkMode
                ? 'bg-gray-700 text-gray-200'
                : 'bg-slate-200 text-slate-700 border border-slate-300/80'
          }`}
          title={scope === 'shared' ? 'Applies on every view that supports it' : 'Only for this view'}
        >
          {scope === 'shared' ? 'Shared' : 'This view'}
        </span>
      ) : null}
      {subtitle ? <InfoTip text={subtitle} isDarkMode={isDarkMode} /> : null}
      <button
        type="button"
        onClick={onClick}
        className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider flex-shrink-0 ${isActive
            ? 'bg-[#13C296]/20 text-[#0f9f7a]'
            : isDarkMode
              ? 'bg-gray-700 text-gray-200'
              : 'bg-slate-200 text-slate-700 border border-slate-300/70'
          }`}
      >
        {isActive ? 'ON' : 'OFF'}
      </button>
    </div>
  );
}

function ConfigurableToggleRow({
  label,
  subtitle,
  isActive,
  onToggle,
  isDarkMode,
  children,
}: {
  label: string;
  subtitle?: string;
  isActive: boolean;
  onToggle: () => void;
  isDarkMode: boolean;
  children?: ReactNode;
}) {
  const [showConfig, setShowConfig] = useState(false);

  useEffect(() => {
    if (!isActive) {
      setShowConfig(false);
    }
  }, [isActive]);

  return (
    <div
      className={`flex flex-col gap-2 rounded-xl border p-3 transition-all ${isActive
          ? isDarkMode
            ? 'border-[#13C296]/50 bg-[#13C296]/15 text-white shadow-2xs'
            : 'border-[#13C296]/40 bg-[#13C296]/10 text-gray-900 shadow-2xs'
          : isDarkMode
            ? 'border-gray-800 bg-gray-800/40 text-gray-400 hover:border-gray-700 hover:text-gray-300'
            : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-900'
        }`}
    >
      <div className="flex items-center justify-between gap-2.5">
        <div
          className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer"
          onClick={onToggle}
        >
          <div
            className={`flex h-4.5 w-4.5 flex-shrink-0 items-center justify-center rounded-full transition-colors ${isActive ? 'bg-[#13C296] text-[#111c18]' : isDarkMode ? 'bg-gray-700' : 'bg-gray-200'
              }`}
          >
            {isActive && <Check className="h-3 w-3 stroke-[3]" />}
          </div>
          <span className="min-w-0 truncate text-[12.5px] font-semibold tracking-tight">{label}</span>
        </div>

        {subtitle ? <InfoTip text={subtitle} isDarkMode={isDarkMode} /> : null}

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {isActive && children && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowConfig(prev => !prev);
              }}
              className={`p-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors ${showConfig
                  ? 'bg-[#13C296]/20 text-[#0f9f7a]'
                  : isDarkMode
                    ? 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                    : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'
                }`}
              title={showConfig ? 'Hide options' : 'Configure options'}
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={onToggle}
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${isActive
                ? 'bg-[#13C296]/20 text-[#0f9f7a]'
                : isDarkMode
                  ? 'bg-gray-700 text-gray-200'
                  : 'bg-slate-200 text-slate-700 border border-slate-300/70'
              }`}
          >
            {isActive ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      {isActive && showConfig && children && (
        <div className="pt-2 border-t border-dashed border-gray-700/30">
          {children}
        </div>
      )}
    </div>
  );
}

function DraggableToggleCard({
  label,
  onLabelChange,
  isActive,
  onToggle,
  onDelete,
  isDarkMode,
  onDragStart,
  onDragOver,
  onDrop,
  isDragging,
  children,
}: {
  label: string;
  onLabelChange?: (newLabel: string) => void;
  isActive: boolean;
  onToggle: () => void;
  onDelete?: () => void;
  isDarkMode: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  isDragging: boolean;
  children?: ReactNode;
}) {
  const [showConfig, setShowConfig] = useState(false);

  useEffect(() => {
    if (!isActive) {
      setShowConfig(false);
    }
  }, [isActive]);

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={`group flex flex-col gap-2 rounded-xl border p-3 transition-all ${isDragging ? 'opacity-40 border-dashed border-[#13C296] scale-[0.98]' : ''
        } ${isActive
          ? isDarkMode
            ? 'border-[#13C296]/50 bg-[#13C296]/15 text-white shadow-2xs'
            : 'border-[#13C296]/40 bg-[#13C296]/10 text-gray-900 shadow-2xs'
          : isDarkMode
            ? 'border-gray-800 bg-gray-800/40 text-gray-400 hover:border-gray-700 hover:text-gray-300'
            : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-900'
        }`}
    >
      <div className="flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="text-gray-400 hover:text-[#13C296] flex-shrink-0 cursor-grab active:cursor-grabbing" title="Drag to reorder left-to-right icon order">
            <GripVertical className="h-4 w-4 stroke-[2]" />
          </div>

          <div
            className={`flex h-4.5 w-4.5 flex-shrink-0 items-center justify-center rounded-full transition-colors cursor-pointer ${isActive ? 'bg-[#13C296] text-[#111c18]' : isDarkMode ? 'bg-gray-700' : 'bg-gray-200'
              }`}
            onClick={onToggle}
          >
            {isActive && <Check className="h-3 w-3 stroke-[3]" />}
          </div>

          {onLabelChange ? (
            <input
              type="text"
              value={label}
              onChange={e => onLabelChange(e.target.value)}
              placeholder="Name your icon..."
              className="bg-transparent border-0 outline-none focus:outline-none ring-0 focus:ring-0 p-0 text-[13px] font-semibold tracking-tight text-inherit cursor-text min-w-0 flex-1"
              style={{ color: 'inherit' }}
            />
          ) : (
            <span className="text-[13px] font-semibold tracking-tight truncate">{label}</span>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {isActive && children && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowConfig(prev => !prev);
              }}
              className={`p-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors ${showConfig
                  ? 'bg-[#13C296]/20 text-[#0f9f7a]'
                  : isDarkMode
                    ? 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                    : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'
                }`}
              title={showConfig ? 'Hide options' : 'Configure options'}
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
          )}

          {onDelete && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="p-1 rounded-lg text-xs font-semibold text-rose-400 hover:bg-rose-500/20 transition-colors"
              title="Delete custom icon"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={onToggle}
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${isActive
                ? 'bg-[#13C296]/20 text-[#0f9f7a]'
                : isDarkMode
                  ? 'bg-gray-700 text-gray-200'
                  : 'bg-slate-200 text-slate-700 border border-slate-300/70'
              }`}
          >
            {isActive ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      {isActive && showConfig && children && (
        <div className="pt-2.5 border-t border-dashed border-[#13C296]/30 flex flex-col gap-2 mt-0.5 transition-all">
          {children}
        </div>
      )}
    </div>
  );
}

export function ConstructionSidebar({
  onClose,
  isDarkMode,
  columns = [],
  customIconElements = [],
  onAddCustomIconElement,
  onRemoveCustomIconElement,
  onUpdateCustomIconElement,
  firstColOrder: _firstColOrder = ['checkbox'],
  onReorderFirstCol: _onReorderFirstCol,
  onOpenIconPickerForElement,
  enableTriggerIcon = false,
  onToggleTriggerIcon: _onToggleTriggerIcon,
  orderedElementKeys = ['expander', 'checkbox', 'icon'],
  onReorderFirstColumnElements,
  customFeatures,
  onToggleFeature,
  onUpdateSummaryChips: _onUpdateSummaryChips,
  actionsAlwaysVisible,
  onToggleActionsAlwaysVisible,
  onOpenIconPicker: _onOpenIconPicker,
  detailViewMode: _detailViewMode = 'sidebar-drawer',
  onDetailViewModeChange: _onDetailViewModeChange,
  customDetailIcon = 'external-link',
  expanderIcon: _expanderIcon = 'chevron',
  onOpenExpanderIconPicker: _onOpenExpanderIconPicker,
  expanderOperation: _expanderOperation = 'inline-subtable',
  onExpanderOperationChange: _onExpanderOperationChange,
  showSubRowCount: _showSubRowCount = true,
  onToggleSubRowCount: _onToggleSubRowCount,
  customRowActionButtons = [],
  onAddCustomRowActionButton,
  onRemoveCustomRowActionButton,
  onUpdateCustomRowActionButton,
  onOpenIconPickerForActionButton,
  onOpenColorPickerForActionButton: _onOpenColorPickerForActionButton,
  isTransposed: _isTransposed = false,
  onToggleTranspose: _onToggleTranspose,
  onSaveFeatures,
  isSavingFeatures = false,
  featuresDirty = false,
  onPatchRowActions,
}: ConstructionSidebarProps) {
  const [isAnimatingIn, setIsAnimatingIn] = useState(false);
  const [draggedKey, setDraggedKey] = useState<FirstColumnElementKey | null>(null);

  useEffect(() => {
    requestAnimationFrame(() => setIsAnimatingIn(true));
  }, []);

  const handleClose = () => {
    setIsAnimatingIn(false);
    setTimeout(onClose, 250);
  };

  const bgClass = isDarkMode ? 'bg-[#111c18] text-gray-100' : 'bg-gray-50 text-gray-800';
  const borderClass = isDarkMode ? 'border-gray-800' : 'border-gray-200';

  const hasCheckbox = Boolean(customFeatures.enableRowSelection);
  const hasSubRows = Boolean(customFeatures.enableSubRows);
  const hasIcon = Boolean(enableTriggerIcon);

  const activeElements: string[] = [];

  orderedElementKeys.forEach(seqItem => {
    if (seqItem === 'expander' && hasSubRows) {
      activeElements.push(`[ > ] Expander`);
    }
    if (seqItem === 'checkbox' && hasCheckbox) {
      activeElements.push('[ ✓ ] Checkbox');
    }
    if (seqItem === 'icon' && hasIcon) {
      activeElements.push(`[ ↗ ] ${customDetailIcon}`);
    }
  });

  const handleDragStart = (key: FirstColumnElementKey) => (e: React.DragEvent) => {
    setDraggedKey(key);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (targetKey: FirstColumnElementKey) => (e: React.DragEvent) => {
    e.preventDefault();
    if (!draggedKey || draggedKey === targetKey) return;

    const newOrder = [...orderedElementKeys];
    const dragIdx = newOrder.indexOf(draggedKey);
    const dropIdx = newOrder.indexOf(targetKey);

    if (dragIdx !== -1 && dropIdx !== -1) {
      newOrder.splice(dragIdx, 1);
      newOrder.splice(dropIdx, 0, draggedKey);
      onReorderFirstColumnElements?.(newOrder);
    }
    setDraggedKey(null);
  };

  // Intent-grouped catalog rows (table-supported).
  const findItems = getTableFeatureItemsForSection(FEATURE_SECTION_FIND) as {
    key: keyof TableFeaturesConfig;
    label: string;
    subtitle?: string;
    scope: FeatureScope;
  }[];
  const chromeItems = getTableFeatureItemsForSection(FEATURE_SECTION_CHROME) as {
    key: keyof TableFeaturesConfig;
    label: string;
    subtitle?: string;
    scope: FeatureScope;
  }[];
  const structureItems = getTableFeatureItemsForSection(FEATURE_SECTION_STRUCTURE) as {
    key: keyof TableFeaturesConfig;
    label: string;
    subtitle?: string;
    scope: FeatureScope;
  }[];

  const interactExtras: { key: keyof TableFeaturesConfig; label: string; subtitle?: string; scope: FeatureScope }[] = [
    { key: 'enableCellEditing', label: 'Inline Cell Editing', subtitle: 'Click a cell to edit its value', scope: 'view' },
  ];
  const summarizeExtras: { key: keyof TableFeaturesConfig; label: string; subtitle?: string; scope: FeatureScope }[] = [
    { key: 'enableFooter', label: 'Aggregation Footer', subtitle: 'Sum, average, count at the bottom of the grid', scope: 'view' },
  ];

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/15 transition-opacity duration-250 ${isAnimatingIn ? 'opacity-100' : 'opacity-0'
          }`}
        onClick={handleClose}
      />

      <div
        className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col shadow-2xl transition-transform duration-250 ease-out ${bgClass} ${isAnimatingIn ? 'translate-x-0' : 'translate-x-full'
          }`}
      >
        <div className={`flex items-center justify-between border-b px-5 py-4 ${borderClass}`}>
          <div>
            <h2 className="text-sm font-bold tracking-tight">Feature Builder</h2>
            <p className="text-[11px] text-gray-400">
              {onSaveFeatures
                ? featuresDirty
                  ? 'Unsaved changes · Save to publish for everyone'
                  : 'Saved for all portal members'
                : 'Grouped by intent · Shared = every supporting view'}
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className={`rounded-lg p-1.5 transition-colors ${isDarkMode ? 'text-gray-400 hover:bg-gray-800 hover:text-white' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
              }`}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-6 p-5 custom-scrollbar">
          {/* Find & Filter */}
          <section className="space-y-2">
            <SectionLabel icon={SlidersHorizontal} isDarkMode={isDarkMode}>Find & Filter</SectionLabel>
            <div className="space-y-2">
              {findItems
                .filter(i => i.key !== 'enableQuickFilters')
                .map(({ key, label, subtitle, scope }) => (
                  <ToggleRow
                    key={key}
                    label={label}
                    subtitle={subtitle}
                    scope={scope}
                    isActive={Boolean(customFeatures[key])}
                    onClick={() => onToggleFeature(key)}
                    isDarkMode={isDarkMode}
                  />
                ))}
              <ConfigurableToggleRow
                label="Quick Filters"
                subtitle="Filter bar under chips — choose fields (synced with header on matching fields)"
                isActive={Boolean(customFeatures.enableQuickFilters)}
                onToggle={() => onToggleFeature('enableQuickFilters')}
                isDarkMode={isDarkMode}
              >
                <QuickFiltersEditor isDarkMode={isDarkMode} columns={columns} compact />
              </ConfigurableToggleRow>
            </div>
          </section>

          {/* Summarize */}
          <section className="space-y-2">
            <SectionLabel icon={Table} isDarkMode={isDarkMode}>Summarize</SectionLabel>
            <div className="space-y-2">
              <ConfigurableToggleRow
                label="Summary Chips"
                subtitle="Headline field totals above every view — up to 3 aggregations per chip"
                isActive={Boolean(customFeatures.enableSummaryChips)}
                onToggle={() => onToggleFeature('enableSummaryChips')}
                isDarkMode={isDarkMode}
              >
                <SummaryChipsEditor isDarkMode={isDarkMode} columns={columns} compact />
              </ConfigurableToggleRow>
              {summarizeExtras.map(({ key, label, subtitle, scope }) => (
                <ToggleRow
                  key={key}
                  label={label}
                  subtitle={subtitle}
                  scope={scope}
                  isActive={Boolean(customFeatures[key])}
                  onClick={() => onToggleFeature(key)}
                  isDarkMode={isDarkMode}
                />
              ))}
            </div>
          </section>

          {/* View Chrome */}
          <section className="space-y-2">
            <SectionLabel icon={SlidersHorizontal} isDarkMode={isDarkMode}>View Chrome</SectionLabel>
            <div className="space-y-2">
              {chromeItems.map(({ key, label, subtitle, scope }) => (
                <ToggleRow
                  key={key}
                  label={label}
                  subtitle={subtitle}
                  scope={scope}
                  isActive={Boolean(customFeatures[key])}
                  onClick={() => onToggleFeature(key)}
                  isDarkMode={isDarkMode}
                />
              ))}
            </div>
          </section>

          {/* Interact */}
          <section className="space-y-2">
            <SectionLabel icon={Layers} isDarkMode={isDarkMode}>Interact</SectionLabel>
            <div className="space-y-2">
              {interactExtras.map(({ key, label, subtitle, scope }) => (
                <ToggleRow
                  key={key}
                  label={label}
                  subtitle={subtitle}
                  scope={scope}
                  isActive={Boolean(customFeatures[key])}
                  onClick={() => onToggleFeature(key)}
                  isDarkMode={isDarkMode}
                />
              ))}
            </div>
          </section>

          {/* First Column Interactive Drag & Drop Controls */}
          <section className="space-y-2">
            <div className="flex items-center justify-between px-1 mb-2">
              <SectionLabel icon={Columns} isDarkMode={isDarkMode}>First Column Controls</SectionLabel>
              <span className="text-[10px] font-semibold text-[#13C296] bg-[#13C296]/15 px-2 py-0.5 rounded-full">
                Drag ⠿ to Reorder
              </span>
            </div>

            <div className="space-y-2">
              {/* Checkbox (Default First Element) */}
              <DraggableToggleCard
                label="Row Selection Checkbox"
                isActive={hasCheckbox}
                onToggle={() => onToggleFeature('enableRowSelection')}
                isDarkMode={isDarkMode}
                onDragStart={handleDragStart('checkbox')}
                onDragOver={handleDragOver}
                onDrop={handleDrop('checkbox')}
                isDragging={draggedKey === 'checkbox'}
              >
                <div className="flex items-center justify-between gap-2">
                  <LabelWithInfo
                    label="Bulk Selection Action Bar"
                    info="Batch toolbar when one or more rows are selected"
                    isDarkMode={isDarkMode}
                    labelClassName="text-xs font-semibold"
                  />
                  <button
                    type="button"
                    onClick={() => onToggleFeature('enableBulkActions')}
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider transition-colors flex-shrink-0 ${customFeatures.enableBulkActions
                        ? 'bg-[#13C296]/20 text-[#0f9f7a]'
                        : isDarkMode
                          ? 'bg-gray-700 text-gray-200'
                          : 'bg-slate-200 text-slate-700 border border-slate-300/70'
                      }`}
                  >
                    {customFeatures.enableBulkActions ? 'ON' : 'OFF'}
                  </button>
                </div>
              </DraggableToggleCard>

              {/* Dynamically Created Custom Action Icon Elements */}
              {customIconElements?.map(item => (
                <DraggableToggleCard
                  key={item.id}
                  label={item.label}
                  onLabelChange={newLabel => onUpdateCustomIconElement?.(item.id, { label: newLabel })}
                  isActive={item.enabled}
                  onToggle={() => onUpdateCustomIconElement?.(item.id, { enabled: !item.enabled })}
                  onDelete={() => onRemoveCustomIconElement?.(item.id)}
                  isDarkMode={isDarkMode}
                  onDragStart={handleDragStart(item.id as any)}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop(item.id as any)}
                  isDragging={draggedKey === item.id}
                >
                  <div className="flex flex-col gap-2 pt-0.5">
                    <div className="flex items-center gap-2">
                      <ActionSelect
                        value={item.action}
                        options={item.action === 'inline-subtable' ? EXPANDER_ACTION_OPTIONS : TRIGGER_ACTION_OPTIONS}
                        onChange={val => onUpdateCustomIconElement?.(item.id, { action: val })}
                        isDarkMode={isDarkMode}
                      />

                      <button
                        type="button"
                        onClick={() => onOpenIconPickerForElement?.(item.id)}
                        className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors flex-shrink-0 ${isDarkMode
                            ? 'border-gray-700 bg-gray-800/80 text-gray-200 hover:border-[#13C296]'
                            : 'border-gray-300 bg-white text-gray-700 hover:border-[#13C296]'
                          }`}
                        title="Change icon"
                      >
                        <Palette className="h-3.5 w-3.5 text-[#13C296]" />
                        <span className="font-mono text-[#13C296] text-[11px] font-bold">{item.iconName}</span>
                      </button>
                    </div>

                    {['copy-column-value', 'filter-by-column', 'sort-column'].includes(item.action) && (
                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-dashed border-gray-700/30">
                        <span className="text-[11px] text-gray-400 font-medium flex-shrink-0">Target Column</span>
                        <ColumnSelect
                          value={item.targetColumnKey || columns[0]?.key || ''}
                          columns={columns}
                          onChange={val => onUpdateCustomIconElement?.(item.id, { targetColumnKey: val })}
                          isDarkMode={isDarkMode}
                        />
                      </div>
                    )}

                    {item.action === 'inline-subtable' && (
                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-dashed border-gray-700/30">
                        <span className="text-[11px] text-gray-400">Show Sub-Row Count Badge</span>
                        <button
                          type="button"
                          onClick={() => onUpdateCustomIconElement?.(item.id, { showSubRowCount: !item.showSubRowCount })}
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider transition-colors ${item.showSubRowCount !== false
                              ? 'bg-[#13C296]/20 text-[#0f9f7a]'
                              : isDarkMode
                                ? 'bg-gray-700 text-gray-200'
                                : 'bg-slate-200 text-slate-700 border border-slate-300/70'
                            }`}
                        >
                          {item.showSubRowCount !== false ? 'ON' : 'OFF'}
                        </button>
                      </div>
                    )}
                  </div>
                </DraggableToggleCard>
              ))}
            </div>

            {/* + Add Custom Action Icon Button */}
            <button
              type="button"
              onClick={() => onAddCustomIconElement?.()}
              className={`w-full mt-2.5 flex items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-2.5 text-xs font-bold transition-all ${isDarkMode
                  ? 'border-[#13C296]/40 text-[#13C296] hover:bg-[#13C296]/15 hover:border-[#13C296]'
                  : 'border-[#13C296]/50 text-[#13C296] hover:bg-[#13C296]/10 hover:border-[#13C296]'
                }`}
            >
              <Plus className="h-4 w-4 stroke-[2.5]" />
              <span>Add Custom Action Icon</span>
            </button>

            <div className="mt-2.5 px-3 py-2 rounded-xl bg-[#13C296]/10 text-[11.5px] text-[#13C296] font-semibold leading-snug flex items-center justify-between">
              <span>Active 1st Column:</span>
              <span className="font-mono text-xs">
                {activeElements.length > 0 ? activeElements.join(' + ') : 'Row Selection Checkbox'}
              </span>
            </div>
          </section>

          {/* Row & Column Features */}
          <section className="space-y-2">
            <SectionLabel icon={Layers} isDarkMode={isDarkMode}>Row & Action Features</SectionLabel>

            <div className="space-y-2">
              <ConfigurableToggleRow
                label="Row Actions Column"
                subtitle="Inline action buttons (edit, delete, share, modal)"
                isActive={Boolean(customFeatures.enableActionsColumn)}
                onToggle={() => onToggleFeature('enableActionsColumn')}
                isDarkMode={isDarkMode}
              >
                <div className="flex flex-col gap-3 py-1">
                  {/* Always Visible Toggle */}
                  <div className="flex items-center justify-between gap-2 pb-2 border-b border-dashed border-gray-700/30">
                    <LabelWithInfo
                      label="Action Buttons Always Visible"
                      info={
                        actionsAlwaysVisible
                          ? 'Buttons stay visible on all rows'
                          : 'Buttons appear on row hover'
                      }
                      isDarkMode={isDarkMode}
                      labelClassName="text-xs font-semibold"
                    />
                    <button
                      type="button"
                      onClick={onToggleActionsAlwaysVisible}
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider transition-colors flex-shrink-0 ${actionsAlwaysVisible
                          ? 'bg-[#13C296]/20 text-[#0f9f7a]'
                          : isDarkMode
                            ? 'bg-gray-700 text-gray-200'
                            : 'bg-slate-200 text-slate-700 border border-slate-300/70'
                        }`}
                    >
                      {actionsAlwaysVisible ? 'ON' : 'OFF'}
                    </button>
                  </div>

                  {/* Built-in Explore action */}
                  <div className="flex items-center justify-between gap-2 pb-2 border-b border-dashed border-gray-700/30">
                    <LabelWithInfo
                      label="Explore action"
                      info="Redirect-style button on each row — page defines what opens on click"
                      isDarkMode={isDarkMode}
                      labelClassName="text-xs font-semibold"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        onPatchRowActions?.({
                          showExplore: !customFeatures.rowActions?.showExplore,
                        })
                      }
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider transition-colors flex-shrink-0 ${
                        customFeatures.rowActions?.showExplore
                          ? 'bg-[#13C296]/20 text-[#0f9f7a]'
                          : isDarkMode
                            ? 'bg-gray-700 text-gray-200'
                            : 'bg-slate-200 text-slate-700 border border-slate-300/70'
                      }`}
                    >
                      {customFeatures.rowActions?.showExplore ? 'ON' : 'OFF'}
                    </button>
                  </div>

                  {/* Built-in Duplicate action */}
                  <div className="flex items-center justify-between gap-2 pb-2 border-b border-dashed border-gray-700/30">
                    <LabelWithInfo
                      label="Duplicate action"
                      info="Copy button — duplicates the row without auto-generated values"
                      isDarkMode={isDarkMode}
                      labelClassName="text-xs font-semibold"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        onPatchRowActions?.({
                          showDuplicate: !customFeatures.rowActions?.showDuplicate,
                        })
                      }
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider transition-colors flex-shrink-0 ${
                        customFeatures.rowActions?.showDuplicate
                          ? 'bg-[#13C296]/20 text-[#0f9f7a]'
                          : isDarkMode
                            ? 'bg-gray-700 text-gray-200'
                            : 'bg-slate-200 text-slate-700 border border-slate-300/70'
                      }`}
                    >
                      {customFeatures.rowActions?.showDuplicate ? 'ON' : 'OFF'}
                    </button>
                  </div>

                  {/* Action Buttons List */}
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                      <span>Action Buttons</span>
                      <span className="text-[10px] font-mono text-[#13C296]">{customRowActionButtons.length} Active</span>
                    </div>

                    {customRowActionButtons.length === 0 ? (
                      <div className={`p-3 rounded-xl border border-dashed text-center text-xs ${isDarkMode ? 'border-gray-800 text-gray-400 bg-gray-900/30' : 'border-gray-200 text-gray-500 bg-gray-50'
                        }`}>
                        No custom action buttons added yet. Click <span className="font-semibold text-[#13C296]">"+ Add Action Button"</span> below to create one.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {customRowActionButtons.map(btn => (
                          <div
                            key={btn.id}
                            className={`flex flex-col gap-2 p-2.5 rounded-xl border transition-all ${btn.enabled
                                ? isDarkMode ? 'border-[#13C296]/40 bg-[#182d27]/70' : 'border-[#13C296]/30 bg-teal-50/40'
                                : isDarkMode ? 'border-gray-800 bg-gray-800/30 opacity-60' : 'border-gray-200 bg-gray-50 opacity-60'
                              }`}
                          >
                            {/* Row 1: Check, Label, Color Palette, Delete */}
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => onUpdateCustomRowActionButton?.(btn.id, { enabled: !btn.enabled })}
                                className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full transition-colors ${btn.enabled ? 'bg-[#13C296] text-[#111c18]' : isDarkMode ? 'bg-gray-700' : 'bg-gray-200'
                                  }`}
                              >
                                {btn.enabled && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                              </button>

                              <input
                                type="text"
                                value={btn.label}
                                onChange={e => onUpdateCustomRowActionButton?.(btn.id, { label: e.target.value })}
                                placeholder="Button label..."
                                className="bg-transparent border-0 outline-none p-0 text-xs font-semibold text-inherit min-w-0 flex-1"
                              />

                              {/* Relative 5x5 Color Picker Popover */}
                              <ActionColorButton
                                color={btn.color || '#13C296'}
                                onChangeColor={c => onUpdateCustomRowActionButton?.(btn.id, { color: c })}
                                isDarkMode={isDarkMode}
                              />

                              <button
                                type="button"
                                onClick={() => onRemoveCustomRowActionButton?.(btn.id)}
                                className="p-1 rounded text-rose-400 hover:bg-rose-500/20 transition-colors flex-shrink-0 ml-1"
                                title="Delete action button"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            {/* Row 2: Action Type select & Icon Picker */}
                            <div className="flex items-center gap-2 pt-1 border-t border-dashed border-gray-700/20">
                              <ActionSelect
                                value={btn.action as any}
                                options={ROW_ACTION_SELECT_OPTIONS}
                                onChange={val => onUpdateCustomRowActionButton?.(btn.id, { action: val as any })}
                                isDarkMode={isDarkMode}
                              />

                              <button
                                type="button"
                                onClick={() => onOpenIconPickerForActionButton?.(btn.id)}
                                className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs font-semibold transition-colors flex-shrink-0 ${isDarkMode
                                    ? 'border-gray-700 bg-gray-800/80 text-gray-200 hover:border-[#13C296]'
                                    : 'border-gray-300 bg-white text-gray-700 hover:border-[#13C296]'
                                  }`}
                                title="Change icon"
                              >
                                <Palette className="h-3.5 w-3.5 text-[#13C296]" />
                                <span className="font-mono text-[#13C296] text-[11px] font-bold">{btn.iconName}</span>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => onAddCustomRowActionButton?.()}
                      className={`w-full mt-1 flex items-center justify-center gap-1.5 rounded-xl border border-dashed px-3 py-2 text-xs font-bold transition-all ${isDarkMode
                          ? 'border-[#13C296]/40 text-[#13C296] hover:bg-[#13C296]/15 hover:border-[#13C296]'
                          : 'border-[#13C296]/50 text-[#13C296] hover:bg-[#13C296]/10 hover:border-[#13C296]'
                        }`}
                    >
                      <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
                      <span>Add Action Button</span>
                    </button>
                  </div>
                </div>
              </ConfigurableToggleRow>
            </div>
          </section>

          {/* Table Structure — add column / row */}
          <section className="space-y-2">
            <SectionLabel icon={Table} isDarkMode={isDarkMode}>Table Structure</SectionLabel>
            <div className="space-y-2">
              {structureItems.map(({ key, label, subtitle, scope }) => (
                <ToggleRow
                  key={key}
                  label={label}
                  subtitle={subtitle}
                  scope={scope}
                  isActive={Boolean(customFeatures[key])}
                  onClick={() => onToggleFeature(key)}
                  isDarkMode={isDarkMode}
                />
              ))}
            </div>
          </section>
        </div>

        {onSaveFeatures && (
          <div className={`flex-shrink-0 border-t px-5 py-4 ${borderClass}`}>
            <button
              type="button"
              disabled={isSavingFeatures || !featuresDirty}
              onClick={() => onSaveFeatures()}
              className={`w-full min-h-[44px] rounded-xl px-4 py-2.5 text-sm font-bold transition-colors
                ${featuresDirty && !isSavingFeatures
                  ? 'bg-[#13C296] text-white hover:bg-[#10a87f]'
                  : isDarkMode
                    ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
            >
              {isSavingFeatures
                ? 'Saving…'
                : featuresDirty
                  ? 'Save for everyone'
                  : 'All changes saved'}
            </button>
            <p className={`mt-2 text-[11px] leading-snug ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
              Toggles preview live. Click Save to store them in MySQL for all users.
            </p>
          </div>
        )}
      </div>
    </>
  );
}




