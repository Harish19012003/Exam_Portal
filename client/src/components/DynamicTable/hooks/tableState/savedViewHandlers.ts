import type { SavedView, SortConfig, FilterValue } from '../../types';
import { genRowId } from '../../utils';
import { getStorageKey } from '../../utils/prefsStorage';

type SetState<T> = React.Dispatch<React.SetStateAction<T>>;

export function loadSavedViews(tableId?: string): SavedView[] {
  try {
    const saved = localStorage.getItem(getStorageKey(tableId) + '_views');
    if (saved) return JSON.parse(saved) as SavedView[];
  } catch {
    /* ignore corrupt storage */
  }
  return [];
}

export function createSavedViewHandlers(
  savedViews: SavedView[],
  activeViewId: string | null,
  columnOrder: string[],
  columnVisibility: Record<string, boolean>,
  columnWidths: Record<string, number>,
  filters: Record<string, FilterValue>,
  sort: SortConfig[],
  setSavedViews: SetState<SavedView[]>,
  setActiveViewId: SetState<string | null>,
  setColumnOrder: SetState<string[]>,
  setColumnVisibility: SetState<Record<string, boolean>>,
  setColumnWidths: SetState<Record<string, number>>,
  setFilters: SetState<Record<string, FilterValue>>,
  setSort: SetState<SortConfig[]>,
  tableId?: string,
) {
  const viewsKey = getStorageKey(tableId) + '_views';
  return {
    handleSaveView: (name: string) => {
      const id = genRowId();
      const newView: SavedView = {
        id,
        name,
        columnOrder,
        columnVisibility,
        columnWidths,
        filters,
        sort,
      };
      setSavedViews(prev => {
        const next = [...prev, newView];
        localStorage.setItem(viewsKey, JSON.stringify(next));
        return next;
      });
      setActiveViewId(id);
    },
    handleLoadView: (id: string) => {
      const view = savedViews.find(v => v.id === id);
      if (!view) return;
      setColumnOrder(view.columnOrder);
      setColumnVisibility(view.columnVisibility);
      setColumnWidths(view.columnWidths);
      setFilters(view.filters);
      setSort(view.sort);
      setActiveViewId(id);
    },
    handleDeleteView: (id: string) => {
      setSavedViews(prev => {
        const next = prev.filter(v => v.id !== id);
        localStorage.setItem(viewsKey, JSON.stringify(next));
        return next;
      });
      if (activeViewId === id) setActiveViewId(null);
    },
  };
}
