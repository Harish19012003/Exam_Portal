import { Check } from 'lucide-react';
import type { AggregationType, ColumnConfig } from '../types';
import { isFieldColumn } from '../types';
import {
  AGGREGATION_LABELS,
  formatAggregationLabel,
  formatAggregationValue,
  getAggregationOptionsForColumn,
} from '../utils/formatAggregation';

interface AggregationFooterCellProps {
  col: ColumnConfig;
  columnWidth: number;
  stickyStyle: React.CSSProperties;
  pinnedBg: string;
  isPinned: boolean;
  isDarkMode: boolean;
  aggValue: number | undefined;
  isDropdownOpen: boolean;
  onToggleDropdown: () => void;
  onSelectAggregation: (agg: AggregationType | undefined) => void;
}

export function AggregationFooterCell({
  col,
  columnWidth,
  stickyStyle,
  pinnedBg,
  isPinned,
  isDarkMode,
  aggValue,
  isDropdownOpen,
  onToggleDropdown,
  onSelectAggregation,
}: AggregationFooterCellProps) {
  const fieldCol = isFieldColumn(col) ? col : null;
  if (!fieldCol) {
    return (
      <td
        style={{ width: columnWidth, minWidth: columnWidth, maxWidth: columnWidth, ...stickyStyle }}
        className={`px-3 py-1.5 ${isPinned ? pinnedBg : ''}`}
      />
    );
  }

  const formattedValue =
    aggValue !== undefined ? formatAggregationValue(fieldCol, aggValue) : '';

  return (
    <td
      style={{ width: columnWidth, minWidth: columnWidth, maxWidth: columnWidth, ...stickyStyle }}
      className={`px-3 py-1.5 align-top font-semibold text-[13px] ${isDarkMode ? 'text-gray-200' : 'text-gray-700'} ${isPinned ? pinnedBg : ''}`}
    >
      <div className="flex flex-col group justify-start overflow-visible relative">
        <button
          type="button"
          onClick={e => {
            e.stopPropagation();
            onToggleDropdown();
          }}
          className={`text-[12px] -ml-1.5 w-fit max-w-full px-1.5 py-0.5 rounded font-medium transition-all flex items-center gap-1 ${isDarkMode ? 'text-gray-400 hover:text-gray-300 hover:bg-gray-800' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'} ${!fieldCol.aggregation ? 'opacity-0 group-hover:opacity-100' : ''}`}
          title="Set aggregation"
        >
          {formatAggregationLabel(fieldCol.aggregation)}
        </button>

        {isDropdownOpen && (
          <div
            className={`absolute bottom-full mb-1 left-0 z-50 w-48 rounded-xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)] border flex flex-col overflow-hidden ${isDarkMode ? 'bg-[#1e293b] border-gray-700' : 'bg-white border-gray-200'}`}
            onClick={e => e.stopPropagation()}
          >
            <div className="max-h-[220px] overflow-y-auto py-1.5 custom-scrollbar">
              <AggregationOption
                label="None"
                isSelected={!fieldCol.aggregation}
                isDarkMode={isDarkMode}
                onClick={() => onSelectAggregation(undefined)}
              />
              {getAggregationOptionsForColumn(fieldCol).map(opt => (
                <AggregationOption
                  key={opt}
                  label={AGGREGATION_LABELS[opt]}
                  isSelected={fieldCol.aggregation === opt}
                  isDarkMode={isDarkMode}
                  onClick={() => onSelectAggregation(opt)}
                />
              ))}
            </div>
          </div>
        )}

        {aggValue !== undefined && (
          <span className="mt-0.5 truncate block" title={formattedValue}>
            {formattedValue}
          </span>
        )}
      </div>
    </td>
  );
}

function AggregationOption({
  label,
  isSelected,
  isDarkMode,
  onClick,
}: {
  label: string;
  isSelected: boolean;
  isDarkMode: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left px-3.5 py-2 text-[13px] font-medium transition-colors flex items-center justify-between ${
        isDarkMode
          ? isSelected
            ? 'bg-slate-800/50 text-white'
            : 'text-slate-300 hover:bg-slate-800 hover:text-white'
          : isSelected
            ? 'bg-slate-50 text-slate-900'
            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
      }`}
    >
      {label}
      {isSelected && <Check className="w-3.5 h-3.5 text-slate-400" />}
    </button>
  );
}
