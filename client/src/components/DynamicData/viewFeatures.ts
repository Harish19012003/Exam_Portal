// Single Feature Builder catalog for all Dynamic* views.
// Grouped by user intent (find, summarize, chrome, interact, structure).
// Items declare which views support them; unsupported ones are omitted.

export type DynamicViewKind = 'table' | 'list' | 'card' | 'kanban' | 'tree' | 'calendar';

/** Shared across every view that lists it · View = this view only. */
export type FeatureScope = 'shared' | 'view';

export interface ViewFeatureItem {
  key: string;
  label: string;
  subtitle?: string;
  /** Groups toggles in the Feature Builder panel. */
  section: string;
  /** Views that can show this toggle. */
  views: readonly DynamicViewKind[];
  /** shared = one setting for every supporting view; view = this layout only. */
  scope: FeatureScope;
}

export const FEATURE_SECTION_FIND = 'Find & Filter';
export const FEATURE_SECTION_SUMMARIZE = 'Summarize';
export const FEATURE_SECTION_CHROME = 'View Chrome';
export const FEATURE_SECTION_INTERACT = 'Interact';
export const FEATURE_SECTION_STRUCTURE = 'Table Structure';

/** Stable section order in Feature Builder panels. */
export const FEATURE_SECTION_ORDER: readonly string[] = [
  FEATURE_SECTION_FIND,
  FEATURE_SECTION_SUMMARIZE,
  FEATURE_SECTION_CHROME,
  FEATURE_SECTION_INTERACT,
  FEATURE_SECTION_STRUCTURE,
];

// Back-compat aliases (older imports / docs)
export const FEATURE_SECTION_TOOLBAR = FEATURE_SECTION_CHROME;
export const FEATURE_SECTION_INTERACTION = FEATURE_SECTION_INTERACT;
export const FEATURE_SECTION_DATA = FEATURE_SECTION_FIND;

/** Find records — search, quick filters, saved presets. */
export const SHARED_FIND_FEATURES: ViewFeatureItem[] = [
  {
    key: 'enableSearch',
    label: 'Global Search',
    subtitle: 'One setting for every view — search across fields',
    section: FEATURE_SECTION_FIND,
    views: ['table', 'list', 'card', 'kanban', 'tree', 'calendar'],
    scope: 'shared',
  },
  {
    key: 'enableQuickFilters',
    label: 'Quick Filters',
    subtitle: 'Filter bar under chips — choose fields (synced with table header on matching fields)',
    section: FEATURE_SECTION_FIND,
    views: ['table', 'list', 'card', 'kanban', 'tree', 'calendar'],
    scope: 'shared',
  },
  {
    key: 'enableSavedViews',
    label: 'Saved Views',
    subtitle: 'Switch custom filter & sort presets',
    section: FEATURE_SECTION_FIND,
    views: ['table'],
    scope: 'view',
  },
];

/** Headline totals and rollups. */
export const SHARED_SUMMARIZE_FEATURES: ViewFeatureItem[] = [
  {
    key: 'enableSummaryChips',
    label: 'Summary Chips',
    subtitle: 'One setting for every view — headline field totals',
    section: FEATURE_SECTION_SUMMARIZE,
    views: ['table', 'list', 'card', 'kanban', 'tree', 'calendar'],
    scope: 'shared',
  },
];

/** Top-bar tools that don’t change the data model. */
export const SHARED_CHROME_FEATURES: ViewFeatureItem[] = [
  {
    key: 'enableRefresh',
    label: 'Refresh',
    subtitle: 'One setting for every view — reload latest records',
    section: FEATURE_SECTION_CHROME,
    views: ['table', 'list', 'card', 'kanban', 'tree', 'calendar'],
    scope: 'shared',
  },
  {
    key: 'enableExport',
    label: 'Export',
    subtitle: 'One setting for every view — CSV / Excel / PDF / JSON',
    section: FEATURE_SECTION_CHROME,
    views: ['table', 'list', 'card', 'kanban', 'tree', 'calendar'],
    scope: 'shared',
  },
  {
    key: 'enableFullScreen',
    label: 'Fullscreen',
    subtitle: 'One setting for every view',
    section: FEATURE_SECTION_CHROME,
    views: ['table', 'list', 'card', 'kanban', 'tree', 'calendar'],
    scope: 'shared',
  },
  {
    key: 'enableDensity',
    label: 'Density',
    subtitle: 'One setting for Table / List / Tree',
    section: FEATURE_SECTION_CHROME,
    views: ['table', 'list', 'tree'],
    scope: 'shared',
  },
  {
    key: 'enableSettings',
    label: 'Table Settings',
    subtitle: 'Column visibility and reset options',
    section: FEATURE_SECTION_CHROME,
    views: ['table'],
    scope: 'view',
  },
  {
    key: 'enableTranspose',
    label: 'Transpose',
    subtitle: 'View-only flip: columns become rows (no editing)',
    section: FEATURE_SECTION_CHROME,
    views: ['table'],
    scope: 'view',
  },
];

/** How users act on records in this layout. */
export const SHARED_INTERACT_FEATURES: ViewFeatureItem[] = [
  {
    key: 'enableOpenDetail',
    label: 'Open Record Detail',
    subtitle: 'One setting for List / Card / Kanban / Tree / Calendar',
    section: FEATURE_SECTION_INTERACT,
    views: ['list', 'card', 'kanban', 'tree', 'calendar'],
    scope: 'shared',
  },
  {
    key: 'enableDragUpdate',
    label: 'Drag Between Columns',
    subtitle: 'Dropping a card updates its group field',
    section: FEATURE_SECTION_INTERACT,
    views: ['kanban'],
    scope: 'view',
  },
  {
    key: 'defaultExpanded',
    label: 'Expand All By Default',
    subtitle: 'Open every branch when the view loads or this is turned on',
    section: FEATURE_SECTION_INTERACT,
    views: ['tree'],
    scope: 'view',
  },
];

/** Table-only schema / construction controls (Feature Builder catalog). */
export const SHARED_STRUCTURE_FEATURES: ViewFeatureItem[] = [
  {
    key: 'enableAddColumn',
    label: 'Add Column',
    subtitle: 'Dynamic column schema builder',
    section: FEATURE_SECTION_STRUCTURE,
    views: ['table'],
    scope: 'view',
  },
  {
    key: 'enableAddRow',
    label: 'Add Row',
    subtitle: 'Quick modal/inline row creation',
    section: FEATURE_SECTION_STRUCTURE,
    views: ['table'],
    scope: 'view',
  },
];

/** @deprecated Prefer SHARED_FIND_FEATURES + SHARED_SUMMARIZE_FEATURES */
export const SHARED_DATA_FEATURES: ViewFeatureItem[] = [
  ...SHARED_FIND_FEATURES.filter(i => i.key === 'enableQuickFilters'),
  ...SHARED_SUMMARIZE_FEATURES,
];

/** @deprecated Prefer SHARED_CHROME_FEATURES + SHARED_STRUCTURE_FEATURES */
export const SHARED_TOOLBAR_FEATURES: ViewFeatureItem[] = [
  ...SHARED_STRUCTURE_FEATURES,
  ...SHARED_CHROME_FEATURES,
  ...SHARED_FIND_FEATURES.filter(i => i.key === 'enableSearch' || i.key === 'enableSavedViews'),
];

/** @deprecated Prefer SHARED_INTERACT_FEATURES */
export const SHARED_INTERACTION_FEATURES = SHARED_INTERACT_FEATURES;

const ALL_SHARED_FEATURES: ViewFeatureItem[] = [
  ...SHARED_FIND_FEATURES,
  ...SHARED_SUMMARIZE_FEATURES,
  ...SHARED_CHROME_FEATURES,
  ...SHARED_INTERACT_FEATURES,
  ...SHARED_STRUCTURE_FEATURES,
];

export { ALL_SHARED_FEATURES };

/** Feature Builder rows for a given view — unsupported items are omitted. */
export function getFeatureItemsForView(view: DynamicViewKind): ViewFeatureItem[] {
  return ALL_SHARED_FEATURES.filter(item => item.views.includes(view));
}

/** Group items by section, in FEATURE_SECTION_ORDER. */
export function groupFeaturesBySection(
  items: ViewFeatureItem[],
): { section: string; items: ViewFeatureItem[] }[] {
  const map = new Map<string, ViewFeatureItem[]>();
  items.forEach(item => {
    const list = map.get(item.section) ?? [];
    list.push(item);
    map.set(item.section, list);
  });
  const ordered: { section: string; items: ViewFeatureItem[] }[] = [];
  FEATURE_SECTION_ORDER.forEach(section => {
    const list = map.get(section);
    if (list && list.length > 0) ordered.push({ section, items: list });
  });
  // Any unknown sections last
  map.forEach((list, section) => {
    if (!FEATURE_SECTION_ORDER.includes(section) && list.length > 0) {
      ordered.push({ section, items: list });
    }
  });
  return ordered;
}

/** Table ConstructionSidebar — catalog rows for a section (table-supported only). */
export function getTableFeatureItemsForSection(section: string): {
  key: string;
  label: string;
  subtitle?: string;
  scope: FeatureScope;
}[] {
  return ALL_SHARED_FEATURES.filter(
    item => item.section === section && item.views.includes('table'),
  ).map(({ key, label, subtitle, scope }) => ({ key, label, subtitle, scope }));
}

/** @deprecated Prefer getTableFeatureItemsForSection / groupFeaturesBySection */
export function getTableToolbarFeatureItems(): {
  key: string;
  label: string;
  subtitle?: string;
}[] {
  return SHARED_TOOLBAR_FEATURES.filter(item => item.views.includes('table')).map(
    ({ key, label, subtitle }) => ({ key, label, subtitle }),
  );
}

// Back-compat aliases used by view components
export const LIST_FEATURE_ITEMS = getFeatureItemsForView('list');
export const CARD_FEATURE_ITEMS = getFeatureItemsForView('card');
export const KANBAN_FEATURE_ITEMS = getFeatureItemsForView('kanban');
export const TREE_FEATURE_ITEMS = getFeatureItemsForView('tree');
export const CALENDAR_FEATURE_ITEMS = getFeatureItemsForView('calendar');

export const LIST_FEATURES_STORAGE_KEY = 'dynamic_list_features_v1';
export const CARD_FEATURES_STORAGE_KEY = 'dynamic_card_features_v1';
export const KANBAN_FEATURES_STORAGE_KEY = 'dynamic_kanban_features_v1';
export const TREE_FEATURES_STORAGE_KEY = 'dynamic_tree_features_v1';
export const CALENDAR_FEATURES_STORAGE_KEY = 'dynamic_calendar_features_v1';
