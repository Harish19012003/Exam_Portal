// Shared "how do we label/identify a record" logic used by every card/list-style
// view (List, Card, Kanban, Tree, Calendar). Prefers an explicit composite
// column (avatar/primary/secondary/badge roles); falls back to the first
// pinned/text-ish fields so raw datasets still render sensibly.
import { isCompositeColumn, isFieldColumn } from '../DynamicTable/types';
import type { ColumnConfig, DataRow } from '../DynamicTable/types';

export interface RecordIdentity {
  avatarUrl?: string;
  iconValue?: string;
  primary: string;
  secondary?: string;
  badge?: string;
  statusValue?: string;
  statusColumn?: ColumnConfig;
  // Which column each slot above was resolved from. Lets a caller avoid
  // re-rendering an identity field as a secondary chip (see getSecondaryFields).
  avatarColumn?: ColumnConfig;
  iconColumn?: ColumnConfig;
  primaryColumn?: ColumnConfig;
  secondaryColumn?: ColumnConfig;
  badgeColumn?: ColumnConfig;
}

const NAME_KEY_HINTS = ['name', 'title', 'full_name', 'label'];
const SUB_KEY_HINTS = ['email', 'designation', 'role', 'description', 'subtitle'];

function findCompositeColumn(columns: ColumnConfig[]): ColumnConfig | undefined {
  return columns.find(isCompositeColumn);
}

function guessTextColumn(columns: ColumnConfig[], hints: string[], exclude: Set<string>): ColumnConfig | undefined {
  const fieldCols = columns.filter(isFieldColumn).filter(c => !exclude.has(c.key));
  for (const hint of hints) {
    const hit = fieldCols.find(c => c.key.toLowerCase().includes(hint) || c.label.toLowerCase().includes(hint));
    if (hit) return hit;
  }
  return fieldCols.find(c => c.dataType === 'text' || c.dataType === 'email');
}

export function getRecordIdentity(row: DataRow, columns: ColumnConfig[]): RecordIdentity {
  const composite = findCompositeColumn(columns);
  const statusColumn = columns.find(c => isFieldColumn(c) && c.dataType === 'status');

  if (composite && isCompositeColumn(composite)) {
    const avatarPart = composite.composedOf.find(p => p.role === 'avatar');
    const iconPart = composite.composedOf.find(p => p.role === 'icon');
    const primaryPart = composite.composedOf.find(p => p.role === 'primary');
    const secondaryPart = composite.composedOf.find(p => p.role === 'secondary');
    const badgePart = composite.composedOf.find(p => p.role === 'badge');

    const columnFor = (field?: string) => (field ? columns.find(c => c.key === field) : undefined);

    return {
      avatarUrl: avatarPart ? String(row.values[avatarPart.field] ?? '') : undefined,
      iconValue: iconPart ? String(row.values[iconPart.field] ?? '') : undefined,
      primary: primaryPart ? String(row.values[primaryPart.field] ?? '') : row.rowId,
      secondary: secondaryPart ? String(row.values[secondaryPart.field] ?? '') : undefined,
      badge: badgePart ? String(row.values[badgePart.field] ?? '') : undefined,
      statusValue: statusColumn ? String(row.values[statusColumn.key] ?? '') : undefined,
      statusColumn,
      avatarColumn: columnFor(avatarPart?.field),
      iconColumn: columnFor(iconPart?.field),
      primaryColumn: columnFor(primaryPart?.field),
      secondaryColumn: columnFor(secondaryPart?.field),
      badgeColumn: columnFor(badgePart?.field),
    };
  }

  const avatarCol = columns.find(c => isFieldColumn(c) && c.dataType === 'image');
  const primaryCol = guessTextColumn(columns, NAME_KEY_HINTS, new Set());
  const secondaryCol = guessTextColumn(columns, SUB_KEY_HINTS, new Set(primaryCol ? [primaryCol.key] : []));

  return {
    avatarUrl: avatarCol ? String(row.values[avatarCol.key] ?? '') : undefined,
    primary: primaryCol ? String(row.values[primaryCol.key] ?? '') : row.rowId,
    secondary: secondaryCol ? String(row.values[secondaryCol.key] ?? '') : undefined,
    statusValue: statusColumn ? String(row.values[statusColumn.key] ?? '') : undefined,
    statusColumn,
    avatarColumn: avatarCol,
    primaryColumn: primaryCol,
    secondaryColumn: secondaryCol,
  };
}

/** Column keys already consumed by an identity's avatar/title/subtitle/badge/status slots. */
export function getIdentityColumnKeys(identity: RecordIdentity): Set<string> {
  const keys = [
    identity.avatarColumn?.key,
    identity.iconColumn?.key,
    identity.primaryColumn?.key,
    identity.secondaryColumn?.key,
    identity.badgeColumn?.key,
    identity.statusColumn?.key,
  ].filter((k): k is string => Boolean(k));
  return new Set(keys);
}

/**
 * Field columns worth showing as small chips on a list row / card.
 *
 * Note: by default this only skips images, attachments and the status column —
 * the title/subtitle columns are NOT skipped, so a caller using the default will
 * render the record's name both as the heading and as the first chip. Pass
 * `excludeKeys` (see getIdentityColumnKeys) to suppress that. The default is
 * kept as-is because every existing view relies on the resulting chip count.
 */
export function getSecondaryFields(
  columns: ColumnConfig[],
  identity: RecordIdentity,
  limit = 4,
  excludeKeys?: Set<string>,
): ColumnConfig[] {
  return columns
    .filter(isFieldColumn)
    .filter(c => c.visible !== false)
    .filter(c => c.dataType !== 'image' && c.dataType !== 'attachment')
    .filter(c => c.key !== identity.statusColumn?.key)
    .filter(c => !excludeKeys?.has(c.key))
    .slice(0, limit);
}
