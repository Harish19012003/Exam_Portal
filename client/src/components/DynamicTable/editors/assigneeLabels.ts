/**
 * Display names for assignee user ids. Seeded when the people picker loads / saves,
 * and when /users/assignable/resolve returns — so table cells never flash raw UUIDs.
 * When a user has a user_code, the label includes it (e.g. "Priya Verma · AM12").
 */

const labels = new Map<string, string>();
const listeners = new Set<() => void>();

const bump = () => {
  listeners.forEach((fn) => fn());
};

/** Name (+ code when present) for chips and closed picker summary. */
export const formatAssigneeDisplay = (u: {
  name?: string;
  email?: string;
  user_code?: string | null;
}): string => {
  const name = String(u?.name || u?.email || '').trim();
  const code = String(u?.user_code || '').trim();
  if (!name) return code;
  if (!code) return name;
  return `${name} · ${code}`;
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

export const seedAssigneeLabels = (
  entries:
    | Record<string, string>
    | Array<{ id: string; name?: string; email?: string; user_code?: string | null }>
    | Record<string, { id?: string; name?: string; email?: string; user_code?: string | null }>,
) => {
  let any = false;
  if (Array.isArray(entries)) {
    entries.forEach((u) => {
      const id = String(u?.id || '');
      const name = formatAssigneeDisplay(u);
      if (!id || !name) return;
      if (labels.get(id) === name) return;
      labels.set(id, name);
      any = true;
    });
  } else if (entries && typeof entries === 'object') {
    Object.entries(entries).forEach(([id, raw]) => {
      if (!id || raw == null) return;
      const name =
        typeof raw === 'string'
          ? String(raw)
          : formatAssigneeDisplay(raw as { name?: string; email?: string; user_code?: string | null });
      if (!name) return;
      if (labels.get(String(id)) === name) return;
      labels.set(String(id), name);
      any = true;
    });
  }
  if (any) bump();
};

export const getAssigneeLabel = (id: string): string | undefined => {
  if (!id) return undefined;
  return labels.get(String(id));
};

/** Reverse lookup: display chip text → user id (for save when the cell still shows a name). */
export const findAssigneeIdByLabel = (label: string): string | undefined => {
  const wanted = String(label || '').trim().toLowerCase();
  if (!wanted) return undefined;
  for (const [id, name] of labels.entries()) {
    if (String(name).trim().toLowerCase() === wanted) return id;
  }
  return undefined;
};
