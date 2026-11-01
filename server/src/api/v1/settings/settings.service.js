import * as settingsRepository from './settings.repository.js';
import * as preferencesRepository from './preferences.repository.js';
import { syncFieldColumns, migrateLegacyJsonRows } from '../exams/exam.repository.js';
import { AppError } from '../../../core/errors.js';
import { ERROR_CODES } from '@exam-view/shared';

export const EXAM_TABLE_CONFIG_KEY = 'exam_table_config';

const tableLayoutDefaultKey = (tableId) => `table_layout_default:${tableId}`;
const tableLayoutUserKey = (tableId) => `table:${tableId}`;

const parseJsonValue = (raw) => {
  if (raw == null) return null;
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const normalizeTableLayout = (input) => {
  if (!input || typeof input !== 'object') return null;
  const layout = {};
  if (Array.isArray(input.columnOrder)) {
    layout.columnOrder = input.columnOrder.filter((k) => typeof k === 'string' && k);
  }
  if (input.columnVisibility && typeof input.columnVisibility === 'object') {
    layout.columnVisibility = { ...input.columnVisibility };
  }
  if (input.columnWidths && typeof input.columnWidths === 'object') {
    const widths = {};
    Object.entries(input.columnWidths).forEach(([key, value]) => {
      const n = Number(value);
      if (Number.isFinite(n) && n > 0) widths[key] = n;
    });
    layout.columnWidths = widths;
  }
  if (typeof input.density === 'string' && input.density) {
    layout.density = input.density;
  }
  return Object.keys(layout).length ? layout : null;
};

const assertTableId = (tableId) => {
  if (!tableId || typeof tableId !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(tableId)) {
    throw new AppError('Invalid table id', 400, ERROR_CODES.VALIDATION_ERROR);
  }
  return tableId;
};

/** Resolve layout: user override → org default → null */
export const getTableLayout = async (tableId, userId) => {
  const id = assertTableId(tableId);
  const userRow = userId
    ? await preferencesRepository.getUserPreference(userId, tableLayoutUserKey(id))
    : null;
  const userLayout = normalizeTableLayout(parseJsonValue(userRow?.pref_value));

  const orgRow = await settingsRepository.getSetting(tableLayoutDefaultKey(id));
  const orgLayout = normalizeTableLayout(parseJsonValue(orgRow?.setting_value));

  if (userLayout) {
    return {
      layout: userLayout,
      source: 'user',
      hasUserOverride: true,
      hasOrgDefault: Boolean(orgLayout),
      orgDefault: orgLayout,
    };
  }
  if (orgLayout) {
    return {
      layout: orgLayout,
      source: 'org',
      hasUserOverride: false,
      hasOrgDefault: true,
      orgDefault: orgLayout,
    };
  }
  return {
    layout: null,
    source: 'none',
    hasUserOverride: false,
    hasOrgDefault: false,
    orgDefault: null,
  };
};

export const saveUserTableLayout = async (tableId, userId, payload) => {
  const id = assertTableId(tableId);
  if (!userId) {
    throw new AppError('Authentication required', 401, ERROR_CODES.UNAUTHORIZED);
  }
  const layout = normalizeTableLayout(payload);
  if (!layout) {
    throw new AppError('Invalid table layout payload', 400, ERROR_CODES.VALIDATION_ERROR);
  }
  await preferencesRepository.upsertUserPreference(userId, tableLayoutUserKey(id), layout);
  return getTableLayout(id, userId);
};

export const clearUserTableLayout = async (tableId, userId) => {
  const id = assertTableId(tableId);
  if (!userId) {
    throw new AppError('Authentication required', 401, ERROR_CODES.UNAUTHORIZED);
  }
  await preferencesRepository.deleteUserPreference(userId, tableLayoutUserKey(id));
  return getTableLayout(id, userId);
};

export const saveOrgTableLayoutDefault = async (tableId, userId, payload) => {
  const id = assertTableId(tableId);
  const layout = normalizeTableLayout(payload);
  if (!layout) {
    throw new AppError('Invalid table layout payload', 400, ERROR_CODES.VALIDATION_ERROR);
  }
  await settingsRepository.upsertSetting(
    tableLayoutDefaultKey(id),
    layout,
    `Org default table layout for ${id}`,
    userId,
  );
  return getTableLayout(id, userId);
};

const DEFAULT_EXAM_TABLE_FEATURES = {
  enableSearch: true,
  enableRefresh: true,
  enableExport: true,
  enableImport: true,
  enableFullScreen: true,
  enableDensity: true,
  enableQuickFilters: true,
  enableSummaryChips: true,
  enableActionsColumn: true,
  enableRowSelection: true,
  enableBulkActions: true,
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
    showExplore: true,
    showDuplicate: false,
    width: 168,
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

  // Field key → real SQL column on exams (config stays JSON; row data is columnar)
  try {
    await syncFieldColumns(normalized.fields);
    await migrateLegacyJsonRows(normalized.fields);
  } catch {
    // Table may be mid-migrate; create/list will retry sync
  }

  return {
    ...normalized,
    updatedAt: row?.updated_at || new Date().toISOString(),
    updatedBy: row?.updated_by || userId || null,
  };
};
