import { useCallback, useState } from 'react';

function readStored<T extends string>(key: string, valid: readonly T[]): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (raw && (valid as readonly string[]).includes(raw)) return raw as T;
  } catch {
    // private mode
  }
  return null;
}

function writeStored(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

/**
 * Default layout for a view’s toolbar switcher (List density, Card layouts, …).
 * Persists to localStorage so the chosen layout is restored on page load.
 */
export function useDefaultLayout<T extends string>(
  storageKey: string,
  validLayouts: readonly T[],
  fallback: T,
) {
  const [defaultLayout, setDefaultLayoutState] = useState<T>(
    () => readStored(storageKey, validLayouts) ?? fallback,
  );

  const setDefaultLayout = useCallback(
    (layout: T) => {
      if (!validLayouts.includes(layout)) return;
      setDefaultLayoutState(layout);
      writeStored(storageKey, layout);
    },
    [storageKey, validLayouts],
  );

  return { defaultLayout, setDefaultLayout };
}
