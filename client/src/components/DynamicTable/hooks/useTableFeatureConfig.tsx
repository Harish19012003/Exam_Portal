import { startTransition, useCallback, useMemo, useState } from 'react';
import type { CustomIconElement, CustomRowActionButton, DataRow, DetailViewMode, RowActionType, RowActionsConfig, SelectionColumnConfig, SummaryChipConfig, TableFeaturesConfig } from '../types';

export type FirstColumnElementKey = 'expander' | 'checkbox' | 'icon';

export const FEATURE_TOGGLE_ITEMS: { key: keyof TableFeaturesConfig; label: string }[] = [
  { key: 'enableSubRows', label: 'Nested Sub-Table' },
  { key: 'enableRowSelection', label: 'Select Column' },
  { key: 'enableActionsColumn', label: 'Actions Column' },
  { key: 'enableAddColumn', label: 'Add Column Button' },
  { key: 'enableSearch', label: 'Search Input' },
  { key: 'enableAddRow', label: 'Add Row Button' },
  { key: 'enableExport', label: 'Export Menu' },
  { key: 'enableImport', label: 'Import CSV' },
  { key: 'enableSavedViews', label: 'Saved Views' },
  { key: 'enableDensity', label: 'Density Switcher' },
  { key: 'enableRefresh', label: 'Refresh Button' },
  { key: 'enableFullScreen', label: 'Fullscreen Button' },
  { key: 'enableSettings', label: 'Settings Gear' },
  { key: 'enableBulkActions', label: 'Bulk Selection Bar' },
  { key: 'enableFooter', label: 'Aggregation Footer' },
  { key: 'enableSummaryChips', label: 'Summary Chips' },
  { key: 'enableQuickFilters', label: 'Quick Filters' },
  { key: 'enableCellEditing', label: 'Cell Inline Editing' },
];

const DEFAULT_CUSTOM_FEATURES: TableFeaturesConfig = {
  enableSubRows: false,
  enableRowSelection: false,
  enableActionsColumn: false,
  enableAddColumn: false,
  enableSearch: false,
  enableAddRow: false,
  enableRefresh: false,
  enableDensity: false,
  enableExport: false,
  enableImport: false,
  enableSavedViews: false,
  enableFullScreen: false,
  enableTranspose: true,
  enableSettings: false,
  enableBulkActions: false,
  enableFooter: false,
  enableSummaryChips: false,
  enableQuickFilters: false,
  summaryChips: [],
  enableCellEditing: false,
};

interface UseTableFeatureConfigOptions {
  isDarkMode: boolean;
  initialFeatures?: TableFeaturesConfig;
  onOpenRecordSidebar?: (row: DataRow) => void;
  onOpenRecordModal?: (row: DataRow) => void;
  onFilterColumn?: (key: string, value: any) => void;
  onToggleColumnVis?: (key: string) => void;
  onSortColumn?: (key: string) => void;
}

export function useTableFeatureConfig({
  isDarkMode: _isDarkMode,
  initialFeatures,
  onOpenRecordSidebar,
  onOpenRecordModal,
  onFilterColumn,
  onToggleColumnVis,
  onSortColumn,
}: UseTableFeatureConfigOptions) {
  const [customIconElements, setCustomIconElements] = useState<CustomIconElement[]>([]);
  const [customRowActionButtons, setCustomRowActionButtons] = useState<CustomRowActionButton[]>([
    { id: 'btn_edit', label: 'Edit', action: 'edit', iconName: 'pencil', color: '#13C296', size: 'md', enabled: true },
    { id: 'btn_delete', label: 'Delete', action: 'delete', iconName: 'trash-2', color: '#f43f5e', size: 'md', enabled: true },
  ]);

  const addCustomRowActionButton = useCallback((presetAction?: RowActionType) => {
    const newAction = presetAction || 'share';
    const newId = `btn_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;
    const defaultLabels: Record<RowActionType, string> = {
      edit: 'Edit',
      delete: 'Delete',
      share: 'Share',
      'open-modal': 'Open Modal',
      'sidebar-drawer': 'Drawer',
      'copy-column-value': 'Copy',
    };
    const defaultIcons: Record<RowActionType, string> = {
      edit: 'pencil',
      delete: 'trash-2',
      share: 'share-2',
      'open-modal': 'maximize-2',
      'sidebar-drawer': 'panel-right-open',
      'copy-column-value': 'copy',
    };
    const defaultColors: Record<RowActionType, string> = {
      edit: '#13C296',
      delete: '#f43f5e',
      share: '#3b82f6',
      'open-modal': '#8b5cf6',
      'sidebar-drawer': '#13C296',
      'copy-column-value': '#f59e0b',
    };

    setCustomRowActionButtons(prev => [
      ...prev,
      {
        id: newId,
        label: defaultLabels[newAction] || 'Action',
        action: newAction,
        iconName: defaultIcons[newAction] || 'star',
        color: defaultColors[newAction] || '#3b82f6',
        size: 'md',
        enabled: true,
      },
    ]);
  }, []);

  const removeCustomRowActionButton = useCallback((id: string) => {
    setCustomRowActionButtons(prev => prev.filter(b => b.id !== id));
  }, []);

  const updateCustomRowActionButton = useCallback((id: string, updates: Partial<CustomRowActionButton>) => {
    setCustomRowActionButtons(prev =>
      prev.map(b => (b.id === id ? { ...b, ...updates } : b))
    );
  }, []);
  const [firstColOrder, setFirstColOrder] = useState<string[]>(['checkbox']);

  const [enableTriggerIcon, setEnableTriggerIcon] = useState(false);
  const [orderedElementKeys, setOrderedElementKeys] = useState<FirstColumnElementKey[]>(['expander', 'checkbox', 'icon']);
  const [detailViewMode, setDetailViewMode] = useState<DetailViewMode>('sidebar-drawer');
  const [customDetailIcon, setCustomDetailIcon] = useState('external-link');
  const [expanderIcon, setExpanderIcon] = useState('chevron');
  const [expanderOperation, setExpanderOperation] = useState<DetailViewMode>('inline-subtable');
  const [showSubRowCount, setShowSubRowCount] = useState(true);
  const [actionsAlwaysVisible, setActionsAlwaysVisible] = useState(false);
  const [chosenIconName, setChosenIconName] = useState('external-link');
  const [isTransposed, setIsTransposed] = useState(false);
  const [customFeatures, setCustomFeatures] = useState<TableFeaturesConfig>(() => ({
    ...DEFAULT_CUSTOM_FEATURES,
    ...initialFeatures,
  }));

  const toggleTranspose = useCallback(() => {
    // Keep the click responsive — rebuilding the flipped grid is expensive.
    startTransition(() => {
      setIsTransposed(prev => !prev);
    });
  }, []);

  const toggleActionsAlwaysVisible = useCallback(() => {
    setActionsAlwaysVisible(prev => !prev);
  }, []);

  const addCustomIconElement = useCallback((presetAction?: DetailViewMode) => {
    const newId = `custom-icon-${Date.now()}`;
    const newElem: CustomIconElement = {
      id: newId,
      label: presetAction === 'inline-subtable' ? 'Sub-Row Expander' : 'Custom Action Icon',
      iconName: presetAction === 'inline-subtable' ? 'chevron' : 'external-link',
      action: presetAction || 'sidebar-drawer',
      showSubRowCount: true,
      enabled: true,
    };
    setCustomIconElements(prev => [...prev, newElem]);
    setFirstColOrder(prev => [...prev, newId]);
  }, []);

  const removeCustomIconElement = useCallback((id: string) => {
    setCustomIconElements(prev => prev.filter(item => item.id !== id));
    setFirstColOrder(prev => prev.filter(item => item !== id));
  }, []);

  const updateCustomIconElement = useCallback((id: string, updates: Partial<CustomIconElement>) => {
    setCustomIconElements(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
  }, []);

  const toggleFeature = useCallback((key: keyof TableFeaturesConfig) => {
    // Shared toolbar flags are owned by sharedViewFeaturesStore — never store them here.
    if (
      key === 'enableSearch' ||
      key === 'enableRefresh' ||
      key === 'enableExport' ||
      key === 'enableFullScreen' ||
      key === 'enableDensity' ||
      key === 'enableSummaryChips' ||
      key === 'enableQuickFilters'
    ) {
      return;
    }
    setCustomFeatures(prev => {
      const nextValue = !prev[key];
      const next = { ...prev, [key]: nextValue };
      // Bulk bar only makes sense with row selection — turn it off when selection is disabled.
      if (key === 'enableRowSelection' && !nextValue) {
        next.enableBulkActions = false;
      }
      return next;
    });
  }, []);

  const patchRowActions = useCallback((patch: Partial<RowActionsConfig>) => {
    setCustomFeatures((prev) => ({
      ...prev,
      rowActions: {
        ...prev.rowActions,
        ...patch,
      },
    }));
  }, []);

  const updateSummaryChips = useCallback((chips: SummaryChipConfig[]) => {
    setCustomFeatures(prev => ({
      ...prev,
      summaryChips: chips.map(chip => ({
        ...chip,
        aggregations: (chip.aggregations ?? []).slice(0, 3),
      })),
    }));
  }, []);

  const toggleTriggerIcon = useCallback(() => {
    setEnableTriggerIcon(prev => !prev);
  }, []);

  const toggleSubRowCount = useCallback(() => {
    setShowSubRowCount(prev => !prev);
  }, []);

  const selectIcon = useCallback((iconName: string) => {
    setChosenIconName(iconName);
    setCustomDetailIcon(iconName);
  }, []);

  const selectExpanderIcon = useCallback((iconName: string) => {
    setExpanderIcon(iconName);
  }, []);

  const changeDetailViewMode = useCallback((mode: DetailViewMode) => {
    setDetailViewMode(mode);
  }, []);

  const reorderFirstColumnElements = useCallback((newOrder: FirstColumnElementKey[]) => {
    setOrderedElementKeys(newOrder);
  }, []);

  const resolvedFeatures = useMemo((): TableFeaturesConfig => {
    const iconToUse = customDetailIcon || chosenIconName || 'external-link';
    const hasCheckbox = Boolean(customFeatures.enableRowSelection);
    const showTriggerIcon = enableTriggerIcon;

    let selectionColConfig = customFeatures.selectionColumn;

    const hasActiveCustomIcon = customIconElements.some(e => e.enabled);

    const baseSelectionConfig: SelectionColumnConfig = {
      mode: (showTriggerIcon || hasActiveCustomIcon) ? (hasCheckbox ? 'checkbox-and-icon' : 'icon-only') : (hasCheckbox ? 'checkbox' : 'none'),
      iconName: iconToUse,
      elementOrder: firstColOrder.length > 0 ? firstColOrder : orderedElementKeys,
      showSubRowCount,
      expanderIcon,
      expanderOperation,
      detailViewMode,
      customIconElements,
      onOpenDrawer: (row: DataRow) => {
        onOpenRecordSidebar?.(row);
      },
      onOpenModal: (row: DataRow) => {
        onOpenRecordModal?.(row);
      },
      onFilterColumn: (key: string, value: any) => {
        onFilterColumn?.(key, value);
      },
      onToggleColumnVis: (key: string) => {
        onToggleColumnVis?.(key);
      },
      onSortColumn: (key: string) => {
        onSortColumn?.(key);
      },
      onRedirectPage: (row: DataRow) => {
        const title = String(row.values.task_name || row.values.first_name || row.values.name || row.rowId);
        alert(`Navigating to record page for: ${title}`);
      },
      onIconClick: (row: DataRow) => {
        if (detailViewMode === 'sidebar-drawer') {
          onOpenRecordSidebar?.(row);
        } else if (detailViewMode === 'open-modal') {
          onOpenRecordModal?.(row);
        } else {
          const title = String(row.values.task_name || row.values.first_name || row.values.name || row.rowId);
          alert(`Navigating to record page for: ${title}`);
        }
      },
    };

    selectionColConfig = baseSelectionConfig;

    return {
      ...customFeatures,
      enableBulkActions: hasCheckbox && Boolean(customFeatures.enableBulkActions),
      selectionColumn: selectionColConfig,
      rowActions: {
        ...customFeatures.rowActions,
        showOnHover: !actionsAlwaysVisible,
        showLabel: true,
        label: customFeatures.rowActions?.label || 'Actions',
        showEdit: customFeatures.rowActions?.showEdit !== false,
        showDelete: customFeatures.rowActions?.showDelete !== false,
        showExplore: Boolean(customFeatures.rowActions?.showExplore),
        showDuplicate: Boolean(customFeatures.rowActions?.showDuplicate),
        customButtons: customRowActionButtons,
      },
    };
  }, [actionsAlwaysVisible, chosenIconName, customDetailIcon, customFeatures, detailViewMode, enableTriggerIcon, expanderIcon, expanderOperation, onOpenRecordSidebar, orderedElementKeys, showSubRowCount, firstColOrder, customIconElements, customRowActionButtons]);

  return {
    enableTriggerIcon,
    toggleTriggerIcon,
    orderedElementKeys,
    reorderFirstColumnElements,
    customIconElements,
    addCustomIconElement,
    removeCustomIconElement,
    updateCustomIconElement,
    customRowActionButtons,
    addCustomRowActionButton,
    removeCustomRowActionButton,
    updateCustomRowActionButton,
    firstColOrder,
    setFirstColOrder,
    detailViewMode,
    changeDetailViewMode,
    customDetailIcon,
    setCustomDetailIcon,
    expanderIcon,
    setExpanderIcon,
    selectExpanderIcon,
    expanderOperation,
    setExpanderOperation,
    showSubRowCount,
    toggleSubRowCount,
    actionsAlwaysVisible,
    setActionsAlwaysVisible,
    toggleActionsAlwaysVisible,
    chosenIconName,
    selectIcon,
    isTransposed,
    toggleTranspose,
    setIsTransposed,
    customFeatures,
    toggleFeature,
    patchRowActions,
    updateSummaryChips,
    resolvedFeatures,
  };
}




