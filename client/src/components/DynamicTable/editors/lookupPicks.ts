/**
 * A lookup cell shows a row's label but must save that row's id. The editor remembers the id it
 * picked here, and the page that saves the row takes it back (see takeLookupPick).
 */
const picks = new Map<string, string>();
const keyOf = (rowId: string, columnKey: string) => `${rowId}\u0000${columnKey}`;

export const setLookupPick = (rowId: string, columnKey: string, id: string) => {
  picks.set(keyOf(rowId, columnKey), id);
};

/** Read the picked id without consuming it (safe if save is invoked more than once). */
export const peekLookupPick = (rowId: string, columnKey: string): string | undefined => {
  return picks.get(keyOf(rowId, columnKey));
};

/** The id picked for this cell since the last save, or undefined. Removes it. */
export const takeLookupPick = (rowId: string, columnKey: string): string | undefined => {
  const k = keyOf(rowId, columnKey);
  const id = picks.get(k);
  picks.delete(k);
  return id;
};

/** Drop any leftover picks for a row after a successful save. */
export const clearLookupPicksForRow = (rowId: string) => {
  const prefix = `${rowId}\u0000`;
  for (const k of [...picks.keys()]) {
    if (k.startsWith(prefix)) picks.delete(k);
  }
};
