import { isCompositeColumn, isFieldColumn } from './types';
import type { CellRendererProps, ColumnConfig, CompositeColumnDef, AttachmentItem } from './types';
import { STATUS_COLORS, avatarColor, countryToFlag, formatCurrency, formatDate, formatDatetime, formatTime, formatNumber, getInitials } from './utils';
import { evaluateFormulaHelper, normalizeFormulaResult } from './utils/evaluateFormula';
import { Icon } from '@iconify/react';

export { evaluateFormulaHelper } from './utils/evaluateFormula';

// ─── Dynamic Badge Colors ─────────────────────────────────────────────────────

const getBadgeColors = (text: string, isDarkMode: boolean) => {
  const hash = Array.from(String(text)).reduce((acc, char) => acc + char.charCodeAt(0), 0);
  
  const lightColors = [
    'bg-indigo-50 text-indigo-700 border-indigo-200',
    'bg-pink-50 text-pink-700 border-pink-200',
    'bg-teal-50 text-teal-700 border-teal-200',
    'bg-amber-50 text-amber-700 border-amber-200',
    'bg-emerald-50 text-emerald-700 border-emerald-200',
    'bg-blue-50 text-blue-700 border-blue-200',
  ];
  
  const darkColors = [
    'bg-indigo-950/40 text-indigo-300 border-indigo-800/50',
    'bg-pink-950/40 text-pink-300 border-pink-800/50',
    'bg-teal-950/40 text-teal-300 border-teal-800/50',
    'bg-amber-950/40 text-amber-300 border-amber-800/50',
    'bg-emerald-950/40 text-emerald-300 border-emerald-800/50',
    'bg-blue-950/40 text-blue-300 border-blue-800/50',
  ];

  return isDarkMode ? darkColors[hash % darkColors.length] : lightColors[hash % lightColors.length];
};

// ─── Status Badge ─────────────────────────────────────────────────────────────

export function StatusBadge({ value, isDarkMode }: { value: string; isDarkMode: boolean }) {
  const colors = STATUS_COLORS[value] ?? {
    light: 'bg-gray-100 text-gray-600',
    dark: 'bg-gray-800 text-gray-400',
    dot: 'bg-gray-400',
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide select-none
        ${isDarkMode ? colors.dark : colors.light}`}
      aria-label={`Status: ${value}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${colors.dot}`} aria-hidden="true" />
      {value}
    </span>
  );
}

// ─── Composite Renderer ───────────────────────────────────────────────────────

export function CompositeCell({
  column,
  row,
  allColumns,
  isDarkMode,
}: {
  column: CompositeColumnDef;
  row: CellRendererProps['row'];
  allColumns?: ColumnConfig[];
  isDarkMode: boolean;
}) {
  const avatarPart  = column.composedOf.find(c => c.role === 'avatar');
  const iconPart    = column.composedOf.find(c => c.role === 'icon');
  const primaryPart = column.composedOf.find(c => c.role === 'primary');
  const secondaryPart = column.composedOf.find(c => c.role === 'secondary');
  const tertiaryPart = column.composedOf.find(c => c.role === 'tertiary');
  const badgePart   = column.composedOf.find(c => c.role === 'badge');
  const prefixPart  = column.composedOf.find(c => c.role === 'prefix');
  const suffixPart  = column.composedOf.find(c => c.role === 'suffix');


  const leftIcon = avatarPart ?? iconPart;
  const rowVals = (row?.values ?? row ?? {}) as Record<string, unknown>;
  const primaryVal = primaryPart ? String(rowVals[primaryPart.field] ?? '') : '';
  const secondaryVal = secondaryPart ? String(rowVals[secondaryPart.field] ?? '') : '';
  const tertiaryVal = tertiaryPart ? String(rowVals[tertiaryPart.field] ?? '') : '';
  const badgeVal = badgePart ? String(rowVals[badgePart.field] ?? '') : '';
  const prefixVal = prefixPart ? String(rowVals[prefixPart.field] ?? '') : '';
  const suffixVal = suffixPart ? String(rowVals[suffixPart.field] ?? '') : '';
  
  const iconRawVal = iconPart ? String(rowVals[iconPart.field] ?? '') : '';
  const iconCol = iconPart && allColumns ? allColumns.find(c => c.key === iconPart.field) : null;

  return (
    <div className="flex items-center gap-2.5 w-full min-w-0">
      {/* Avatar / Icon */}
      {leftIcon && (
        avatarPart ? (
          <AvatarCell
            src={String(rowVals[avatarPart.field] ?? '')}
            name={primaryVal}
            isDarkMode={isDarkMode}
          />
        ) : (
          <span className="text-xl flex-shrink-0 leading-none select-none flex items-center justify-center" aria-hidden="true">
            {iconCol && isFieldColumn(iconCol) && iconCol.dataType === 'icon' ? (
              iconRawVal.includes(':') ? (
                <Icon icon={iconRawVal} className={`w-5 h-5 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`} />
              ) : (
                iconRawVal
              )
            ) : (
              countryToFlag(iconRawVal)
            )}
          </span>
        )
      )}

      {/* Stacked text */}
      <div className="min-w-0 flex-1 overflow-hidden">
        {(primaryPart || prefixPart || suffixPart) && (
          <div className="flex items-baseline gap-1.5 min-w-0 truncate">
            {prefixPart && prefixVal && (
              <span className={`text-[11px] font-medium flex-shrink-0 max-w-[80px] truncate ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                {prefixVal}
              </span>
            )}
            {primaryPart && (
              <span className={`font-semibold text-[13px] truncate ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                {primaryVal}
              </span>
            )}
            {suffixPart && suffixVal && (
              <span className={`text-[11px] font-medium flex-shrink-0 max-w-[80px] truncate ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                {suffixVal}
              </span>
            )}
          </div>
        )}
        
        {(secondaryPart || badgePart) && (
          <div className="flex items-center gap-2 mt-0.5 min-w-0">
            {secondaryPart && (
              <span className={`text-[11px] truncate ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                {secondaryVal}
              </span>
            )}
            {badgePart && badgeVal && (
              <span className={`px-2 py-[2px] rounded-full text-[9px] font-bold tracking-wide flex-shrink-0 max-w-[100px] truncate border ${getBadgeColors(badgeVal, isDarkMode)}`}>
                {badgeVal}
              </span>
            )}
          </div>
        )}
        
        {tertiaryPart && tertiaryVal && (
          <div className={`text-[10px] truncate mt-0.5 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
            {tertiaryVal}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Avatar Cell ───────────────────────────────────────────────────────────────

function AvatarCell({ src, name, isDarkMode }: { src: string; name: string; isDarkMode: boolean }) {
  const bg = avatarColor(name);
  const initials = getInitials(name);
  const borderColor = isDarkMode ? '#111827' : '#ffffff';

  return (
    <div
      className="w-9 h-9 rounded-full flex-shrink-0 overflow-hidden flex items-center justify-center text-white text-[12px] font-bold select-none"
      style={{
        backgroundColor: bg,
        outline: `2.5px solid ${borderColor}`,
        outlineOffset: '-1px',
      }}
      aria-label={name}
    >
      {src ? (
        <img
          src={src}
          alt={name}
          className="w-full h-full object-cover"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = 'none';
            (e.currentTarget.nextElementSibling as HTMLElement)?.classList.remove('hidden');
          }}
        />
      ) : null}
      <span className={src ? 'hidden' : ''}>{initials}</span>
    </div>
  );
}

// ─── Cell Renderer (main dispatcher) ─────────────────────────────────────────

export function CellRenderer({ value, row, column, allColumns: _allColumns, isDarkMode, onDirectEdit }: CellRendererProps) {
  if (isCompositeColumn(column)) {
    return <CompositeCell column={column} row={row} allColumns={_allColumns} isDarkMode={isDarkMode} />;
  }

  const str = String(value ?? '');

  if (column.dataType === 'formula' && column.formula) {
    const computed = evaluateFormulaHelper(column, row, _allColumns);

    if (computed === undefined) {
      return <span className="text-red-500 text-xs">Error</span>;
    }

    const displayValue = normalizeFormulaResult(column, computed);
    const resultType = column.resultType;
    const displayType =
      resultType && resultType !== 'composite' && resultType !== 'formula'
        ? resultType
        : 'number';

    return (
      <CellRenderer
        value={displayValue}
        row={row}
        column={{ ...column, dataType: displayType }}
        allColumns={_allColumns}
        isDarkMode={isDarkMode}
        onDirectEdit={onDirectEdit}
      />
    );
  }

  switch (column.dataType) {
    case 'text':
      return (
        <div className={`text-[13px] truncate block ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
          {str || <span className={`italic ${isDarkMode ? 'text-gray-600' : 'text-gray-300'}`}>—</span>}
        </div>
      );

    case 'icon':
      return (
        <div className="flex items-center justify-center w-full">
          {str ? (
            str.includes(':') ? (
              <Icon icon={str} className={`w-5 h-5 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`} />
            ) : (
              <span className="text-[18px] leading-none">{str}</span>
            )
          ) : (
            <span className={`italic text-[13px] ${isDarkMode ? 'text-gray-600' : 'text-gray-300'}`}>—</span>
          )}
        </div>
      );

    case 'number':
      return (
        <div className={`group flex items-center gap-1.5 text-[13px] font-medium tabular-nums ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
          <span className="truncate">{value !== null && value !== undefined ? formatNumber(value) : <span className="text-gray-400">—</span>}</span>
          {value !== null && value !== undefined && (
            <button
              onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(String(value)); }}
              className={`opacity-0 group-hover:opacity-100 p-1 rounded-md transition-opacity flex-shrink-0 ${isDarkMode ? 'hover:bg-gray-700 text-gray-400 hover:text-gray-200' : 'hover:bg-gray-100 text-gray-500 hover:text-gray-800'}`}
              title="Copy"
            >
              <Icon icon="hugeicons:copy-01" className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      );

    case 'currency':
      return (
        <span className={`text-[13px] font-semibold tabular-nums ${isDarkMode ? 'text-gray-100' : 'text-gray-800'}`}>
          {value !== null && value !== undefined ? formatCurrency(value) : <span className="text-gray-400">—</span>}
        </span>
      );

    case 'date':
      return (
        <span className={`text-[12px] font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
          {value ? formatDate(value) : <span className="text-gray-400">—</span>}
        </span>
      );
      
    case 'datetime':
      return (
        <span className={`text-[12px] font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
          {value ? formatDatetime(value) : <span className="text-gray-400">—</span>}
        </span>
      );

    case 'time':
      return (
        <span className={`text-[12px] font-medium tabular-nums ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
          {value ? formatTime(value) : <span className="text-gray-400">—</span>}
        </span>
      );

    case 'boolean':
      return (
        <div className="w-full flex justify-center">
          <button 
            onClick={onDirectEdit ? (e) => { e.stopPropagation(); onDirectEdit(!value); } : undefined}
            disabled={!onDirectEdit}
            className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[#13C296] focus-visible:ring-offset-1 ${isDarkMode ? 'focus-visible:ring-offset-gray-800' : ''} ${value ? 'bg-[#13C296]' : (isDarkMode ? 'bg-gray-700' : 'bg-gray-300')} ${onDirectEdit ? 'cursor-pointer' : 'cursor-default'}`}
            aria-label={`Toggle ${column.label}`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${value ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
          </button>
        </div>
      );

    case 'checkbox':
      return (
        <div className="w-full flex justify-center">
          <button
            onClick={onDirectEdit ? (e) => { e.stopPropagation(); onDirectEdit(!value); } : undefined}
            disabled={!onDirectEdit}
            className={`flex items-center justify-center w-5 h-5 rounded border transition-colors outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[#13C296] focus-visible:ring-offset-1 ${isDarkMode ? 'focus-visible:ring-offset-gray-800 border-gray-600' : 'border-gray-300'} ${value ? 'bg-[#13C296] border-[#13C296]' : (isDarkMode ? 'bg-gray-800' : 'bg-white')} ${onDirectEdit ? 'cursor-pointer' : 'cursor-default'}`}
            aria-label={`Toggle ${column.label}`}
          >
            {Boolean(value) && (
              <svg className="w-3.5 h-3.5 text-white pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>
        </div>
      );

    case 'status':
      return str ? <StatusBadge value={str} isDarkMode={isDarkMode} /> : null;

    case 'code':
      return (
        <span className="font-semibold text-[13px] text-gray-900 dark:text-gray-100 tracking-tight">
          {str}
        </span>
      );

    case 'mono':
      return (
        <span className="font-mono text-[12px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
          {str}
        </span>
      );

    case 'dot':
      return (
        <div className="w-full flex justify-center items-center">
          <span
            className={`w-2.5 h-2.5 rounded-full inline-block transition-transform hover:scale-125 ${
              Boolean(value)
                ? 'bg-[#10b981] shadow-[0_0_6px_rgba(16,185,129,0.5)]'
                : isDarkMode ? 'bg-gray-600' : 'bg-gray-400'
            }`}
            title={Boolean(value) ? 'Active / Yes' : 'No / Disabled'}
          />
        </div>
      );

    case 'dropdown':
      return str ? (
        <span className={`inline-flex px-2 py-0.5 rounded-md text-[12px] font-medium
          ${isDarkMode ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-700'}`}>
          {str}
        </span>
      ) : null;

    case 'multiselect': {
      const tags = Array.isArray(value) ? value as string[] : str ? [str] : [];
      return (
        <div className="flex flex-wrap gap-1">
          {tags.map(t => (
            <span key={t} className={`px-1.5 py-0.5 rounded text-[11px] font-medium
              ${isDarkMode ? 'bg-indigo-900/40 text-indigo-300' : 'bg-indigo-50 text-indigo-700'}`}>
              {t}
            </span>
          ))}
        </div>
      );
    }

    case 'progress': {
      const pVal = Number(value) || 0;
      return (
        <div className="w-full flex items-center gap-2">
          <div className={`flex-1 h-1.5 rounded-full ${isDarkMode ? 'bg-gray-800' : 'bg-gray-200'} overflow-hidden`}>
            <div className={`h-full rounded-full ${pVal > 80 ? 'bg-emerald-500' : pVal > 40 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${Math.min(100, Math.max(0, pVal))}%` }} />
          </div>
          <span className={`text-[11px] font-medium w-8 text-right tabular-nums ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>{pVal}%</span>
        </div>
      );
    }

    case 'rating': {
      const rVal = Number(value) || 0;
      return (
        <div className="flex items-center gap-0.5">
          {[1, 2, 3, 4, 5].map(star => (
            <Icon 
              key={star} 
              icon="hugeicons:star" 
              className={`w-3.5 h-3.5 ${star <= rVal ? 'text-amber-400 fill-amber-400' : (isDarkMode ? 'text-gray-700' : 'text-gray-300')}`} 
            />
          ))}
        </div>
      );
    }

    case 'tags': {
      const tagList = Array.isArray(value) ? value as string[] : str ? str.split(',').map(s => s.trim()) : [];
      const colors = ['bg-blue-100 text-blue-700', 'bg-purple-100 text-purple-700', 'bg-pink-100 text-pink-700', 'bg-orange-100 text-orange-700', 'bg-teal-100 text-teal-700'];
      const darkColors = ['bg-blue-900/40 text-blue-300', 'bg-purple-900/40 text-purple-300', 'bg-pink-900/40 text-pink-300', 'bg-orange-900/40 text-orange-300', 'bg-teal-900/40 text-teal-300'];
      return (
        <div className="flex flex-wrap gap-1">
          {tagList.map((t, i) => (
            <span key={t} className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider
              ${isDarkMode ? darkColors[i % darkColors.length] : colors[i % colors.length]}`}>
              {t}
            </span>
          ))}
        </div>
      );
    }

    case 'email':
      return str ? (
        <div className="group flex items-center gap-1 min-w-0 -ml-1">
          <a href={`mailto:${str}`} onClick={e => e.stopPropagation()} className={`inline-flex items-center justify-center p-1 rounded-md transition-colors ${isDarkMode ? 'text-blue-400 hover:bg-gray-700 hover:text-blue-300' : 'text-blue-600 hover:bg-blue-50 hover:text-blue-700'}`} title="Send Email">
            <Icon icon="hugeicons:mail-01" className="w-3.5 h-3.5 flex-shrink-0" />
          </a>
          <span className={`truncate text-[13px] font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>{str}</span>
          <button
            onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(str); }}
            className={`opacity-0 group-hover:opacity-100 ml-0.5 p-1 rounded-md transition-opacity flex-shrink-0 ${isDarkMode ? 'hover:bg-gray-700 text-gray-400 hover:text-gray-200' : 'hover:bg-gray-100 text-gray-500 hover:text-gray-800'}`}
            title="Copy Email"
          >
            <Icon icon="hugeicons:copy-01" className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : <span className={`italic ${isDarkMode ? 'text-gray-600' : 'text-gray-300'}`}>—</span>;

    case 'phone':
      return str ? (
        <div className="group flex items-center gap-1 min-w-0 -ml-1">
          <a href={`tel:${str.replace(/[^\d+]/g, '')}`} onClick={e => e.stopPropagation()} className={`inline-flex items-center justify-center p-1 rounded-md transition-colors ${isDarkMode ? 'text-blue-400 hover:bg-gray-700 hover:text-blue-300' : 'text-blue-600 hover:bg-blue-50 hover:text-blue-700'}`} title="Call">
            <Icon icon="hugeicons:call" className="w-3.5 h-3.5 flex-shrink-0" />
          </a>
          <span className={`truncate text-[13px] font-medium tabular-nums ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>{str}</span>
          <div className="opacity-0 group-hover:opacity-100 flex items-center transition-opacity ml-0.5 flex-shrink-0">
            <a href={`https://wa.me/${str.replace(/[^\d]/g, '')}`} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className={`p-1 rounded-md transition-colors ${isDarkMode ? 'hover:bg-gray-700 text-green-400 hover:text-green-300' : 'hover:bg-green-50 text-green-600 hover:text-green-700'}`} title="Message on WhatsApp">
              <Icon icon="mdi:whatsapp" className="w-4 h-4" />
            </a>
            <button
              onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(str); }}
              className={`p-1 rounded-md transition-colors ${isDarkMode ? 'hover:bg-gray-700 text-gray-400 hover:text-gray-200' : 'hover:bg-gray-100 text-gray-500 hover:text-gray-800'}`}
              title="Copy Phone"
            >
              <Icon icon="hugeicons:copy-01" className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ) : <span className={`italic ${isDarkMode ? 'text-gray-600' : 'text-gray-300'}`}>—</span>;

    case 'attachment': {
      const items = Array.isArray(value) ? value as AttachmentItem[] : (typeof value === 'string' && value ? [{ id: '1', name: value.split('/').pop() || 'Attachment', url: value, type: value.match(/\.(jpeg|jpg|gif|png|webp)$/i) ? 'image' : 'file' }] as AttachmentItem[] : []);
      if (items.length === 0) return <span className={`italic ${isDarkMode ? 'text-gray-600' : 'text-gray-300'}`}>—</span>;
      if (items.length === 1) {
        const item = items[0];
        return (
          <a href={item.url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-[12px] font-medium transition-colors ${isDarkMode ? 'border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'}`}>
            <Icon icon={item.type === 'image' ? "hugeicons:image-01" : "hugeicons:file-attachment"} className="w-3.5 h-3.5 opacity-70" />
            <span className="truncate max-w-[100px]">{item.name}</span>
          </a>
        );
      }
      return (
        <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-[12px] font-medium transition-colors ${isDarkMode ? 'border-gray-700 bg-gray-800 text-gray-300' : 'border-gray-200 bg-gray-50 text-gray-700'}`}>
          <Icon icon="hugeicons:folder-open" className="w-3.5 h-3.5 opacity-70" />
          <span>{items.length} Files</span>
        </span>
      );
    }

    case 'image':
      return str ? (
        <img src={str} alt="" className="w-8 h-8 rounded-lg object-cover" />
      ) : null;

    case 'link':
      return str ? (
        <a
          href={str.startsWith('http') ? str : `https://${str}`}
          target="_blank"
          rel="noreferrer"
          className="text-[13px] text-[#13C296] hover:underline underline-offset-2 truncate"
          onClick={e => e.stopPropagation()}
        >
          {str}
        </a>
      ) : null;

    default:
      return <span className="text-[13px]">{str}</span>;
  }
}
