// Shared record design model for every Dynamic* view.
//
// Field placement used to be implicit: getRecordIdentity guessed the title and
// subtitle from column-name hints, and the chips were "the first N columns".
// Those two guesses overlap, so one field could occupy two slots at once.
//
// Here each visual slot is an explicit assignment. `fieldKey: undefined` means
// "auto", which defers to getRecordIdentity exactly as before — so a generated
// default config renders identically to the old hardcoded JSX until someone
// opens the designer.
//
// What a record *is* (media, title, subtitle, badge, status, fields) is shared.
// How it is *arranged* is per-view, supplied via a ViewLayoutDefinition.
import { isFieldColumn } from '../DynamicTable/types';
import type { ColumnConfig, DataRow, DataType } from '../DynamicTable/types';
import { getRecordIdentity, getSecondaryFields, getIdentityColumnKeys } from './recordIdentity';
import type { RecordAvatarShape } from './RecordAvatar';

export type RecordMediaKind = 'avatar' | 'image' | 'icon' | 'none';

/** `fieldKey: undefined` means auto-resolve from composite roles, then heuristics. */
export interface RecordSlotAssignment {
  fieldKey?: string;
  show: boolean;
}

export interface RecordFieldEntry {
  fieldKey: string;
  showLabel: boolean;
  span: 1 | 2;
}

export interface RecordMediaConfig {
  fieldKey?: string;
  kind: RecordMediaKind;
  /** Overrides the layout's default size when set. */
  size?: number;
  shape: RecordAvatarShape;
}

export interface RecordDesignConfig<TLayout extends string = string> {
  layout: TLayout;
  media: RecordMediaConfig;
  title: RecordSlotAssignment;
  subtitle: RecordSlotAssignment;
  badge: RecordSlotAssignment;
  status: RecordSlotAssignment;
  /** `null` means auto — reproduces the old getSecondaryFields behaviour. */
  fields: RecordFieldEntry[] | null;
  /** Drop fields already bound to a slot from the auto field list. */
  excludeIdentityFields: boolean;
  showDividers: boolean;
  cornerRadius: number;
  accentColor: string;
}

/** The parts of a view's layout definition the shared resolver needs. */
export interface ViewLayoutDefinition {
  label: string;
  description: string;
  showFieldLabels: boolean;
  /** Cap used when deriving the auto field count. */
  autoFieldCap: number;
  mediaSize: number;
  mediaShape: RecordAvatarShape;
}

// The old per-view chipColumns memos all filtered on these before taking
// .length as the cap. Only the count was ever used.
const AUTO_CHIP_EXCLUDED_TYPES: DataType[] = ['image', 'attachment', 'text', 'status'];

/**
 * Reproduces the old `chipColumns.length` cap: count the columns that survive
 * the chip filter, capped by the layout.
 */
export function computeAutoFieldLimit(
  columns: ColumnConfig[],
  cap: number,
  excludeKeys?: Set<string>,
): number {
  return columns
    .filter(isFieldColumn)
    .filter(
      c =>
        c.visible !== false &&
        !AUTO_CHIP_EXCLUDED_TYPES.includes(c.dataType) &&
        !excludeKeys?.has(c.key),
    )
    .slice(0, cap).length;
}

export function createDefaultRecordDesign<TLayout extends string>(
  layout: TLayout,
  layoutDef: ViewLayoutDefinition,
  overrides?: Partial<RecordDesignConfig<TLayout>>,
): RecordDesignConfig<TLayout> {
  return {
    layout,
    media: { kind: 'avatar', shape: layoutDef.mediaShape },
    title: { show: true },
    subtitle: { show: true },
    badge: { show: false },
    status: { show: true },
    fields: null,
    excludeIdentityFields: false,
    showDividers: true,
    cornerRadius: 16,
    accentColor: '#13C296',
    ...overrides,
  };
}

export interface ResolvedRecordSlots {
  mediaValue?: string;
  showMedia: boolean;
  title: string;
  subtitle?: string;
  badge?: string;
  statusValue?: string;
  fields: RecordFieldEntry[];
  fieldColumns: Record<string, ColumnConfig>;
}

function readValue(row: DataRow, fieldKey?: string): string | undefined {
  if (!fieldKey) return undefined;
  const raw = row.values[fieldKey];
  return raw === undefined || raw === null ? undefined : String(raw);
}

/** Slot keys the user pinned explicitly — never repeated in the field list. */
function assignedSlotKeys(design: RecordDesignConfig): Set<string> {
  const keys = [
    design.media.fieldKey,
    design.title.fieldKey,
    design.subtitle.fieldKey,
    design.badge.fieldKey,
    design.status.fieldKey,
  ];
  return new Set(keys.filter((k): k is string => Boolean(k)));
}

export interface ResolveRecordSlotsOptions {
  /** Extra keys never offered as auto fields (e.g. Kanban's group-by column). */
  excludeFieldKeys?: Set<string>;
}

export function resolveRecordSlots(
  row: DataRow,
  columns: ColumnConfig[],
  design: RecordDesignConfig,
  layoutDef: ViewLayoutDefinition,
  options?: ResolveRecordSlotsOptions,
): ResolvedRecordSlots {
  const identity = getRecordIdentity(row, columns);

  const title = readValue(row, design.title.fieldKey) ?? identity.primary;
  const subtitle = design.subtitle.show
    ? (readValue(row, design.subtitle.fieldKey) ?? identity.secondary)
    : undefined;
  const badge = design.badge.show ? (readValue(row, design.badge.fieldKey) ?? identity.badge) : undefined;
  const statusValue = design.status.show
    ? (readValue(row, design.status.fieldKey) ?? identity.statusValue)
    : undefined;
  const mediaValue =
    design.media.kind === 'icon'
      ? (readValue(row, design.media.fieldKey) ?? identity.iconValue)
      : (readValue(row, design.media.fieldKey) ?? identity.avatarUrl);

  const explicit = assignedSlotKeys(design);
  options?.excludeFieldKeys?.forEach(k => explicit.add(k));

  let fields: RecordFieldEntry[];
  if (design.fields) {
    fields = design.fields.filter(f => !explicit.has(f.fieldKey));
  } else {
    const exclude = new Set(explicit);
    if (design.excludeIdentityFields) {
      getIdentityColumnKeys(identity).forEach(k => exclude.add(k));
    }
    const limit = computeAutoFieldLimit(columns, layoutDef.autoFieldCap, options?.excludeFieldKeys);
    fields = getSecondaryFields(columns, identity, limit, exclude.size > 0 ? exclude : undefined).map(col => ({
      fieldKey: col.key,
      showLabel: layoutDef.showFieldLabels,
      span: 1 as const,
    }));
  }

  const fieldColumns: Record<string, ColumnConfig> = {};
  for (const entry of fields) {
    const col = columns.find(c => c.key === entry.fieldKey);
    if (col) fieldColumns[entry.fieldKey] = col;
  }

  return {
    mediaValue,
    showMedia: design.media.kind !== 'none',
    title,
    subtitle: subtitle || undefined,
    badge: badge || undefined,
    statusValue: statusValue || undefined,
    fields: fields.filter(f => fieldColumns[f.fieldKey]),
    fieldColumns,
  };
}

// ─── Persistence ───────────────────────────────────────────────────────────────

export function loadRecordDesign<TLayout extends string>(
  storageKey: string,
  fallback: RecordDesignConfig<TLayout>,
  validLayouts?: readonly TLayout[],
): RecordDesignConfig<TLayout> {
  try {
    const saved = localStorage.getItem(storageKey);
    if (!saved) return fallback;
    const parsed = JSON.parse(saved) as Partial<RecordDesignConfig<TLayout>>;
    const layout =
      typeof parsed.layout === 'string' &&
      (!validLayouts || validLayouts.includes(parsed.layout as TLayout))
        ? (parsed.layout as TLayout)
        : fallback.layout;
    return {
      ...fallback,
      ...parsed,
      layout,
      media: { ...fallback.media, ...parsed.media },
      title: { ...fallback.title, ...parsed.title },
      subtitle: { ...fallback.subtitle, ...parsed.subtitle },
      badge: { ...fallback.badge, ...parsed.badge },
      status: { ...fallback.status, ...parsed.status },
    };
  } catch {
    return fallback;
  }
}

export function saveRecordDesign(storageKey: string, design: RecordDesignConfig): void {
  try {
    localStorage.setItem(storageKey, JSON.stringify(design));
  } catch {
    // Ignore quota / private-mode failures
  }
}
