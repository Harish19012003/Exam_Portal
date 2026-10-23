// Renders one record from a resolved slot set. Shared by Card, List and Kanban:
// arrangement and class strings come from the view's layout registry, so adding
// a layout is an entry in that registry rather than another JSX branch.
import { memo } from 'react';
import type { ReactNode } from 'react';
import { CellRenderer, StatusBadge } from '../DynamicTable/renderers';
import { DynamicIcon } from '../IconPicker';
import type { ColumnConfig, DataRow } from '../DynamicTable/types';
import { RecordAvatar } from './RecordAvatar';
import { resolveRecordSlots } from './recordDesign';
import type { RecordDesignConfig, ResolveRecordSlotsOptions, ViewLayoutDefinition } from './recordDesign';

export type RecordArrangement = 'header' | 'stacked' | 'inline' | 'cover';

export interface RecordItemLayout extends ViewLayoutDefinition {
  arrangement: RecordArrangement;
  /** Classes for the item shell, minus border radius (driven by cornerRadius). */
  itemClass: string;
  titleClass: string;
  subtitleClass: string;
  /** Field container classes, minus the divider colour (see fieldsDivider). */
  fieldsClass: string;
  fieldsDivider: 'theme' | 'dashed' | 'none';
  /** Wrapper classes applied to each field cell. */
  fieldCellClass: string;
  badgePlacement: 'title-inline' | 'trailing';
  /** Container the view renders the items into (grid/flex classes). */
  containerClass: string;
  /**
   * When true, items flatten on small screens (divider rows, no nested card radius).
   * Use for List-style views inside a framed shell.
   */
  flattenOnMobile?: boolean;
}

/** `#13C296` at 0.4 reproduces Tailwind's `border-[#13C296]/40` exactly. */
export function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean;
  const int = parseInt(full, 16);
  if (Number.isNaN(int) || full.length !== 6) return hex;
  return `rgba(${(int >> 16) & 255}, ${(int >> 8) & 255}, ${int & 255}, ${alpha})`;
}

export interface RecordItemProps {
  row: DataRow;
  columns: ColumnConfig[];
  design: RecordDesignConfig;
  layout: RecordItemLayout;
  isDarkMode: boolean;
  /** Background/border classes for the shell — views differ here. */
  shellClass: string;
  onClick?: () => void;
  /** Rendered at the start of the item (Tree expand chevron). */
  leading?: ReactNode;
  /** Rendered at the end of the item (List's hover chevron). */
  trailing?: ReactNode;
  extraClassName?: string;
  resolveOptions?: ResolveRecordSlotsOptions;
  draggable?: boolean;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

function RecordItemComponent({
  row,
  columns,
  design,
  layout,
  isDarkMode,
  shellClass,
  onClick,
  leading,
  trailing,
  extraClassName = '',
  resolveOptions,
  draggable,
  onDragStart,
  onDragEnd,
}: RecordItemProps) {
  const slots = resolveRecordSlots(row, columns, design, layout, resolveOptions);
  const mediaSize = design.media.size ?? layout.mediaSize;

  const dividerCls = !design.showDividers
    ? 'border-transparent'
    : layout.fieldsDivider === 'dashed'
      ? 'border-dashed border-gray-500/15'
      : layout.fieldsDivider === 'theme'
        ? isDarkMode
          ? 'border-gray-800'
          : 'border-gray-100'
        : '';

  const radius =
    design.media.shape === 'circle' ? 9999 : design.media.shape === 'rounded' ? 14 : 4;

  const media = slots.showMedia ? (
    design.media.kind === 'icon' ? (
      <div
        className="flex-shrink-0 flex items-center justify-center"
        style={{ width: mediaSize, height: mediaSize, color: design.accentColor }}
      >
        <DynamicIcon iconName={slots.mediaValue || 'star'} className="w-full h-full" />
      </div>
    ) : design.media.kind === 'image' && slots.mediaValue ? (
      <img
        src={slots.mediaValue}
        alt={slots.title}
        loading="lazy"
        decoding="async"
        className="flex-shrink-0 object-cover"
        style={{ width: mediaSize, height: mediaSize, borderRadius: radius }}
      />
    ) : (
      <RecordAvatar
        url={slots.mediaValue}
        name={slots.title}
        size={mediaSize}
        shape={design.media.shape}
        isDarkMode={isDarkMode}
        ringWidth={layout.arrangement === 'inline' ? 2.5 : 3}
      />
    )
  ) : null;

  const badgeChip = slots.badge ? (
    <span
      className={`px-1.5 py-[1px] rounded-full text-[9px] font-bold flex-shrink-0 ${isDarkMode ? 'bg-teal-900/40 text-teal-300' : 'bg-teal-50 text-teal-700'}`}
    >
      {slots.badge}
    </span>
  ) : null;

  const inlineBadge = layout.badgePlacement === 'title-inline' ? badgeChip : null;
  const trailingBadge = layout.badgePlacement === 'trailing' ? badgeChip : null;

  const titleBlock = (
    <>
      {inlineBadge ? (
        <div className="flex items-center gap-2 min-w-0">
          <p className={`${layout.titleClass} truncate ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>
            {slots.title}
          </p>
          {inlineBadge}
        </div>
      ) : (
        <p className={`${layout.titleClass} truncate ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>
          {slots.title}
        </p>
      )}
      {slots.subtitle && <p className={`${layout.subtitleClass} truncate text-gray-500`}>{slots.subtitle}</p>}
    </>
  );

  const statusBadge = slots.statusValue ? (
    <div className="flex-shrink-0">
      <StatusBadge value={slots.statusValue} isDarkMode={isDarkMode} />
    </div>
  ) : null;

  const fieldsBlock =
    slots.fields.length > 0 ? (
      <div className={`${layout.fieldsClass} ${dividerCls}`}>
        {slots.fields.map((entry, index) => {
          const col = slots.fieldColumns[entry.fieldKey];
          const isGridTwo = /\bgrid-cols-2\b/.test(layout.fieldsClass);
          const spanFull =
            entry.span === 2 ||
            (isGridTwo && slots.fields.length % 2 === 1 && index === slots.fields.length - 1);
          return (
            <div
              key={entry.fieldKey}
              className={layout.fieldCellClass}
              style={spanFull ? { gridColumn: 'span 2' } : undefined}
            >
              {entry.showLabel && (
                <p
                  className={`text-[10px] font-medium tracking-[0.04em] uppercase leading-none ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}
                >
                  {col.label}
                </p>
              )}
              <div className="min-w-0 w-full">
                <CellRenderer
                  value={row.values[entry.fieldKey]}
                  row={row}
                  column={col}
                  allColumns={columns}
                  isDarkMode={isDarkMode}
                />
              </div>
            </div>
          );
        })}
      </div>
    ) : null;

  const radiusCls = layout.flattenOnMobile
    ? 'rounded-none lg:[border-radius:var(--record-radius)]'
    : '[border-radius:var(--record-radius)]';

  const hoverBorderCls = layout.flattenOnMobile
    ? 'max-lg:hover:border-gray-100 lg:hover:border-[var(--record-accent)]'
    : 'hover:border-[var(--record-accent)]';

  return (
    <div
      onClick={onClick}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`min-w-0 w-full overflow-hidden ${layout.itemClass} ${shellClass} ${radiusCls} ${hoverBorderCls} ${extraClassName}`}
      style={{
        // Radius via CSS var so mobile can flatten (inline borderRadius would win over utilities).
        ['--record-radius' as string]: `${design.cornerRadius}px`,
        ['--record-accent' as string]: hexToRgba(design.accentColor, 0.4),
      }}
    >
      {layout.arrangement === 'stacked' && (
        <>
          {leading}
          {media}
          <div className="min-w-0 w-full">{titleBlock}</div>
          {trailingBadge}
          {statusBadge}
          {fieldsBlock}
          {trailing}
        </>
      )}

      {layout.arrangement === 'header' && (
        <>
          {leading}
          <div className="flex items-center gap-3 min-w-0">
            {media}
            <div className="min-w-0 flex-1">{titleBlock}</div>
            {trailingBadge}
            {statusBadge}
          </div>
          {fieldsBlock}
          {trailing}
        </>
      )}

      {layout.arrangement === 'inline' && (
        <>
          {leading}
          {media}
          <div className="min-w-0 flex-1 overflow-hidden">{titleBlock}</div>
          {fieldsBlock}
          {trailingBadge}
          {statusBadge}
          {trailing}
        </>
      )}

      {layout.arrangement === 'cover' && (
        <>
          {leading}
          <div
            className="w-full flex items-center justify-center"
            style={{ height: mediaSize + 32, backgroundColor: hexToRgba(design.accentColor, 0.12) }}
          >
            {media}
          </div>
          <div className="flex flex-col gap-3 p-4">
            <div className="min-w-0 flex items-center gap-2">
              <div className="min-w-0 flex-1">{titleBlock}</div>
              {trailingBadge}
              {statusBadge}
            </div>
            {fieldsBlock}
            {trailing}
          </div>
        </>
      )}
    </div>
  );
}

export const RecordItem = memo(RecordItemComponent);
