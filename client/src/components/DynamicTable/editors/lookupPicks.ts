/**
 * A lookup cell shows a row's label but must save that row's id. The editor remembers the id it
 * picked here, and the page that saves the row takes it back (see takeLookupPick).
 */
const picks = new Map<string, string>();
const keyOf = (rowId: string, columnKey: string) => `${rowId}\u0000${columnKey}`;

export const setLookupPick = (rowId: string, columnKey: string, id: string) => {
  picks.set(keyOf(rowId, columnKey), id);
};

/** The id picked for this cell since the last save, or undefined. Removes it. */
export const takeLookupPick = (rowId: string, columnKey: string): string | undefined => {
  const k = keyOf(rowId, columnKey);
  const id = picks.get(k);
  picks.delete(k);
  return id;
};
