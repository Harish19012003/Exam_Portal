/**
 * Instant cell text after a lookup pick. Written synchronously in the click handler so the
 * selected field (and siblings) paint before React save / parent row sync catch up.
 */

const overrides = new Map<string, string>(); // `${rowId}\0${colKey}` -> display text
const listeners = new Set<() => void>();

const keyOf = (rowId: string, colKey: string) => `${rowId}\u0000${colKey}`;

const bump = () => {
  listeners.forEach((fn) => fn());
};

export const subscribeLookupDisplayOverrides = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};

export const setLookupDisplayOverride = (rowId: string, colKey: string, text: string) => {
  if (!rowId || !colKey) return;
  overrides.set(keyOf(rowId, colKey), text);
  bump();
};

export const setLookupDisplayOverrides = (rowId: string, patch: Record<string, string>) => {
  if (!rowId || !patch) return;
  let any = false;
  Object.entries(patch).forEach(([colKey, text]) => {
    if (!colKey) return;
    overrides.set(keyOf(rowId, colKey), text == null ? '' : String(text));
    any = true;
  });
  if (any) bump();
};

export const getLookupDisplayOverride = (rowId: string, colKey: string): string | undefined => {
  if (!rowId || !colKey) return undefined;
  return overrides.get(keyOf(rowId, colKey));
};

export const clearLookupDisplayOverrides = (rowId: string) => {
  const prefix = `${rowId}\u0000`;
  let any = false;
  for (const k of [...overrides.keys()]) {
    if (k.startsWith(prefix)) {
      overrides.delete(k);
      any = true;
    }
  }
  if (any) bump();
};
