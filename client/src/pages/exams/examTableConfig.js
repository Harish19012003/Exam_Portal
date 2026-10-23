import { apiClient } from '../../api/client';
import { loadExamFields, saveExamFields } from './examFieldTypes';

export const EXAM_TABLE_CONFIG_CACHE_KEY = 'exam_table_config_cache_v1';

/** Features every portal member sees when super admin publishes config */
export const DEFAULT_EXAM_TABLE_FEATURES = {
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
  features: {
    ...DEFAULT_EXAM_TABLE_FEATURES,
    summaryChips: [],
    quickFilterFieldKeys: [],
  },
  updatedAt: null,
  updatedBy: null,
});

const CONFIGURE_ROLES = new Set(['super_admin', 'global_admin', 'admin']);
const CONFIGURE_RIGHTS = new Set(['settings:manage', 'exams:manage']);

/** Super admin + permission admins may open Feature / Field Builder */
export const canConfigureExamTable = (user = null) => {
  let u = user;
  if (!u) {
    try {
      u = JSON.parse(localStorage.getItem('user') || '{}');
    } catch {
      u = {};
    }
  }
  if (CONFIGURE_ROLES.has(u?.role)) return true;
  const rights = Array.isArray(u?.permissions) ? u.permissions : [];
  return rights.some((r) => CONFIGURE_RIGHTS.has(r));
};

export const normalizeExamTableConfig = (input) => {
  const base = getDefaultExamTableConfig();
  if (!input || typeof input !== 'object') return base;
  const featuresIn = input.features && typeof input.features === 'object' ? input.features : {};
  return {
    version: 1,
    fields: Array.isArray(input.fields) ? input.fields : [],
    features: {
      ...base.features,
      ...featuresIn,
      enableAddColumn: false,
      enableAddRow: false,
      enableSubRows: false,
      summaryChips: Array.isArray(featuresIn.summaryChips) ? featuresIn.summaryChips : [],
      quickFilterFieldKeys: Array.isArray(featuresIn.quickFilterFieldKeys)
        ? featuresIn.quickFilterFieldKeys
        : [],
      rowActions: {
        ...base.features.rowActions,
        ...(featuresIn.rowActions && typeof featuresIn.rowActions === 'object'
          ? featuresIn.rowActions
          : {}),
      },
    },
    updatedAt: input.updatedAt || null,
    updatedBy: input.updatedBy || null,
  };
};

export const readExamTableConfigCache = () => {
  try {
    const raw = localStorage.getItem(EXAM_TABLE_CONFIG_CACHE_KEY);
    if (!raw) return null;
    return normalizeExamTableConfig(JSON.parse(raw));
  } catch {
    return null;
  }
};

export const writeExamTableConfigCache = (config, { allowEmptyFields = false } = {}) => {
  try {
    const normalized = normalizeExamTableConfig(config);
    localStorage.setItem(EXAM_TABLE_CONFIG_CACHE_KEY, JSON.stringify(normalized));
    // Avoid wiping a local schema with an unpublished empty server default
    if (
      Array.isArray(normalized.fields) &&
      (normalized.fields.length > 0 || allowEmptyFields)
    ) {
      saveExamFields(normalized.fields);
    }
    return normalized;
  } catch {
    return normalizeExamTableConfig(config);
  }
};

/**
 * Prefer server fields when published; otherwise keep local / recovered schema
 * so a fresh empty Settings row does not erase existing Exam Builder work.
 */
export const mergeExamTableConfigWithLocal = (remote, localFields = loadExamFields()) => {
  const server = normalizeExamTableConfig(remote);
  const local = Array.isArray(localFields) ? localFields : [];
  const serverHasFields = Array.isArray(server.fields) && server.fields.length > 0;
  const localHasFields = local.length > 0;

  if (serverHasFields) {
    writeExamTableConfigCache(server);
    return { config: server, needsPublish: false };
  }

  if (localHasFields) {
    const merged = {
      ...server,
      fields: local,
    };
    // Cache keeps server features + local fields; do not blank exam_form_fields_v2
    try {
      localStorage.setItem(EXAM_TABLE_CONFIG_CACHE_KEY, JSON.stringify(merged));
    } catch {
      // ignore
    }
    return { config: merged, needsPublish: true };
  }

  // Empty unpublished server config — leave local fields file untouched
  try {
    localStorage.setItem(EXAM_TABLE_CONFIG_CACHE_KEY, JSON.stringify(server));
  } catch {
    // ignore
  }
  return { config: server, needsPublish: false };
};

/** Load shared config (API → merge local fields → cache) */
export const fetchExamTableConfig = async () => {
  const localFields = loadExamFields();
  try {
    const { data } = await apiClient.get('/settings/exam-table-config');
    const { config, needsPublish } = mergeExamTableConfigWithLocal(
      data?.data ?? data,
      localFields,
    );
    return { ...config, _needsPublish: needsPublish };
  } catch {
    const cached = readExamTableConfigCache();
    if (cached?.fields?.length) return { ...cached, _needsPublish: false };
    return {
      ...getDefaultExamTableConfig(),
      fields: localFields,
      _needsPublish: Boolean(localFields.length),
    };
  }
};

/**
 * Rebuild a minimal field schema from IndexedDB exam snapshots
 * (used when localStorage was wiped by an empty server config).
 */
export const recoverFieldsFromExams = (exams = []) => {
  const byKey = new Map();
  (Array.isArray(exams) ? exams : []).forEach((exam) => {
    const snap = Array.isArray(exam?.fields) ? exam.fields : [];
    snap.forEach((f, index) => {
      if (!f?.key || byKey.has(f.key)) return;
      byKey.set(f.key, {
        id: `recovered_${f.key}`,
        key: f.key,
        label: f.label || f.key,
        dataType: f.dataType || 'text',
        autoFill: f.autoFill || 'none',
        required: false,
        layout: 'full',
        order: typeof f.order === 'number' ? f.order : index,
        options: [],
        optionsSource: 'manual',
        allowMultiple: false,
        sameAsFieldKey: '',
        sameAsDefaultOn: true,
      });
    });
  });
  return Array.from(byKey.values()).sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0),
  );
};

/** Publish Feature Builder + field schema for all portal members */
export const publishExamTableConfig = async ({ fields, features }) => {
  const payload = normalizeExamTableConfig({
    fields: Array.isArray(fields) ? fields : [],
    features: features && typeof features === 'object' ? features : {},
  });
  const { data } = await apiClient.put('/settings/exam-table-config', payload);
  const saved = normalizeExamTableConfig(data?.data ?? data);
  writeExamTableConfigCache(saved, { allowEmptyFields: true });
  return saved;
};

/** Snapshot Feature Builder–related store flags into a features object */
export const buildFeaturesSnapshot = ({
  customFeatures = {},
  sharedFlags = {},
  summaryChips = { enabled: false, chips: [] },
  quickFilters = { enabled: false, fieldKeys: [] },
} = {}) =>
  normalizeExamTableConfig({
    features: {
      ...DEFAULT_EXAM_TABLE_FEATURES,
      ...customFeatures,
      ...sharedFlags,
      enableSummaryChips: Boolean(summaryChips.enabled),
      enableQuickFilters: Boolean(quickFilters.enabled),
      summaryChips: Array.isArray(summaryChips.chips) ? summaryChips.chips : [],
      quickFilterFieldKeys: Array.isArray(quickFilters.fieldKeys) ? quickFilters.fieldKeys : [],
    },
  }).features;
