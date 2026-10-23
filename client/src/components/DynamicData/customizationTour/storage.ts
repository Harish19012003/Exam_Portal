const STORAGE_KEY = 'dynamic_views_customization_tour_v1';

export type CustomizationTourStatus = 'pending' | 'completed' | 'skipped';

export function getCustomizationTourStatus(): CustomizationTourStatus {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === 'completed' || raw === 'skipped') return raw;
  } catch {
    // private mode
  }
  return 'pending';
}

export function setCustomizationTourStatus(status: Exclude<CustomizationTourStatus, 'pending'>) {
  try {
    localStorage.setItem(STORAGE_KEY, status);
  } catch {
    // ignore
  }
}

export function resetCustomizationTourStatus() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
