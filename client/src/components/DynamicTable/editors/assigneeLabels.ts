/**
 * Display names for assignee user ids. Seeded when the people picker loads / saves,
 * and when /users/assignable/resolve returns — so table cells never flash raw UUIDs.
 */

const labels = new Map<string, string>();
const listeners = new Set<() => void>();

const bump = () => {
  listeners.forEach((fn) => fn());
};

export const subscribeAssigneeLabels = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};

export const seedAssigneeLabel = (id: string, name: string) => {
  if (!id || !name) return;
  const prev = labels.get(id);
  if (prev === name) return;
  labels.set(String(id), String(name));
  bump();
};

export const seedAssigneeLabels = (entries: Record<string, string> | Array<{ id: string; name?: string; email?: string }>) => {
  let any = false;
  if (Array.isArray(entries)) {
    entries.forEach((u) => {
      const id = String(u?.id || '');
      const name = u?.name || u?.email || '';
      if (!id || !name) return;
      if (labels.get(id) === name) return;
      labels.set(id, name);
      any = true;
    });
  } else if (entries && typeof entries === 'object') {
    Object.entries(entries).forEach(([id, name]) => {
      if (!id || !name) return;
      if (labels.get(id) === String(name)) return;
      labels.set(String(id), String(name));
      any = true;
    });
  }
  if (any) bump();
};

export const getAssigneeLabel = (id: string): string | undefined => {
  if (!id) return undefined;
  return labels.get(String(id));
};
