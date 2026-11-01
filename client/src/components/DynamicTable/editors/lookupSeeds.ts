/**
 * Optimistic lookup values after a picker selection. Keys are source-table column keys
 * (e.g. vendor_code, vendor_name) for a given source row id — so sibling group fields can
 * paint immediately without waiting for /resolve.
 */

type SeedMap = Map<string, Record<string, string>>; // id -> { columnKey: value }

const byTable = new Map<string, SeedMap>();
const listeners = new Set<() => void>();

const bump = () => {
  listeners.forEach((fn) => fn());
};

export const subscribeLookupSeeds = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};

export const seedLookupRow = (table: string, id: string, values: Record<string, string>) => {
  if (!table || !id || !values || typeof values !== 'object') return;
  let tableMap = byTable.get(table);
  if (!tableMap) {
    tableMap = new Map();
    byTable.set(table, tableMap);
  }
  const prev = tableMap.get(id) || {};
  tableMap.set(id, { ...prev, ...values });
  bump();
};

export const getLookupSeed = (table: string, id: string): Record<string, string> | null => {
  if (!table || !id) return null;
  return byTable.get(table)?.get(id) || null;
};
