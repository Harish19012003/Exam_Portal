import * as settingsRepository from './settings.repository.js';

export const EXAM_TABLE_CONFIG_KEY = 'exam_table_config';

const DEFAULT_EXAM_TABLE_FEATURES = {
  enableSearch: true,
  enableRefresh: true,
  enableExport: true,
  enableFullScreen: true,
  enableDensity: true,
  enableQuickFilters: true,
  enableSummaryChips: true,
  enableActionsColumn: true,
  enableRowSelection: true,
  enableBulkActions: false,
  enableCellEditing: true,
  enableFooter: false,
  enableSavedViews: false,
  enableAddColumn: false,
  enableAddRow: false,
  enableSubRows: false,
  enableTranspose: false,
  enableSettings: false,
  enableOpenDetail: true,
  summaryChips: [],
  quickFilterFieldKeys: [],
  rowActions: {
    showOnHover: false,
    showEdit: true,
    showDelete: true,
    width: 108,
  },
};

export const getDefaultExamTableConfig = () => ({
  version: 1,
  fields: [],
  features: { ...DEFAULT_EXAM_TABLE_FEATURES, summaryChips: [], quickFilterFieldKeys: [] },
});

const parseSettingValue = (raw) => {
  if (raw == null) return null;
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const normalizeExamTableConfig = (input) => {
  const base = getDefaultExamTableConfig();
  if (!input || typeof input !== 'object') return base;

  const featuresIn = input.features && typeof input.features === 'object' ? input.features : {};
  const features = {
    ...base.features,
    ...featuresIn,
    summaryChips: Array.isArray(featuresIn.summaryChips)
      ? featuresIn.summaryChips
      : Array.isArray(input.summaryChips)
        ? input.summaryChips
        : [],
    quickFilterFieldKeys: Array.isArray(featuresIn.quickFilterFieldKeys)
      ? featuresIn.quickFilterFieldKeys
      : Array.isArray(input.quickFilterFieldKeys)
        ? input.quickFilterFieldKeys
        : [],
    rowActions: {
      ...base.features.rowActions,
      ...(featuresIn.rowActions && typeof featuresIn.rowActions === 'object'
        ? featuresIn.rowActions
        : {}),
    },
  };

  // Schema/construction tools stay admin-only — never expose as shared defaults for everyone
  features.enableAddColumn = false;
  features.enableAddRow = false;
  features.enableSubRows = false;

  return {
    version: 1,
    fields: Array.isArray(input.fields) ? input.fields : [],
    features,
  };
};

export const getExamTableConfig = async () => {
  const row = await settingsRepository.getSetting(EXAM_TABLE_CONFIG_KEY);
  if (!row) {
    return {
      ...getDefaultExamTableConfig(),
      updatedAt: null,
      updatedBy: null,
    };
  }
  const parsed = normalizeExamTableConfig(parseSettingValue(row.setting_value));
  return {
    ...parsed,
    updatedAt: row.updated_at || null,
    updatedBy: row.updated_by || null,
  };
};

export const saveExamTableConfig = async (payload, userId) => {
  const normalized = normalizeExamTableConfig(payload);
  const row = await settingsRepository.upsertSetting(
    EXAM_TABLE_CONFIG_KEY,
    normalized,
    'Shared Exam management table schema + Feature Builder config',
    userId,
  );
  return {
    ...normalized,
    updatedAt: row?.updated_at || new Date().toISOString(),
    updatedBy: row?.updated_by || userId || null,
  };
};
