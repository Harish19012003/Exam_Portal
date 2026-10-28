import {
  defaultValueForType,
  buildSameAsFlags,
  DATE_LINK_TYPES,
  validatePhoneFieldValue,
} from './examFieldTypes';
import {
  getSharedViewFeatures,
  replaceSharedViewFeatures,
} from '../../components/DynamicData/sharedViewFeaturesStore';
import {
  getSummaryChipsState,
  replaceSummaryChipsState,
} from '../../components/DynamicData/summaryChipsStore';
import {
  getQuickFiltersState,
  replaceQuickFiltersState,
} from '../../components/DynamicData/quickFiltersStore';
import { DEFAULT_EXAM_TABLE_FEATURES } from './examTableConfig';

/** Capture the shared Feature Builder stores so a page can restore them on unmount. */
export const snapshotFeatureStores = () => ({
  shared: { ...getSharedViewFeatures() },
  chips: { ...getSummaryChipsState() },
  quick: { ...getQuickFiltersState() },
});

export const restoreFeatureStores = (snap) => {
  if (!snap) return;
  replaceSharedViewFeatures(snap.shared);
  replaceSummaryChipsState(snap.chips);
  replaceQuickFiltersState(snap.quick);
};

/** Feature Builder draft -> features we persist (rows/columns are managed elsewhere). */
export const normalizeFeaturesDraft = (features) => ({
  ...DEFAULT_EXAM_TABLE_FEATURES,
  ...features,
  enableAddColumn: false,
  enableAddRow: false,
  enableSubRows: false,
  quickFilterFieldKeys: Array.isArray(features.quickFilterFieldKeys)
    ? features.quickFilterFieldKeys
    : getQuickFiltersState().fieldKeys,
  summaryChips: Array.isArray(features.summaryChips)
    ? features.summaryChips
    : getSummaryChipsState().chips,
});

export const hydrateFeatureStores = (features = {}) => {
  replaceSharedViewFeatures({
    enableSearch: Boolean(features.enableSearch),
    enableRefresh: Boolean(features.enableRefresh),
    enableExport: Boolean(features.enableExport),
    enableFullScreen: Boolean(features.enableFullScreen),
    enableDensity: Boolean(features.enableDensity),
    enableOpenDetail: Boolean(features.enableOpenDetail),
  });
  replaceSummaryChipsState({
    enabled: Boolean(features.enableSummaryChips),
    chips: Array.isArray(features.summaryChips) ? features.summaryChips : [],
    visible: true,
  });
  replaceQuickFiltersState({
    enabled: Boolean(features.enableQuickFilters),
    fieldKeys: Array.isArray(features.quickFilterFieldKeys)
      ? features.quickFilterFieldKeys
      : [],
    visible: true,
    values: {},
  });
};

export const applySameAsDefaults = (fields, values, flags) => {
  const next = { ...values };
  fields.forEach((f) => {
    if (
      f.sameAsFieldKey &&
      DATE_LINK_TYPES.has(f.dataType) &&
      flags[f.key]
    ) {
      next[f.key] = next[f.sameAsFieldKey] ?? '';
    }
  });
  return next;
};

export const buildEmptyForm = (fields = []) => {
  const values = {};
  fields.forEach((f) => {
    values[f.key] = defaultValueForType(f.dataType, f.autoFill, f.allowMultiple);
  });
  return applySameAsDefaults(fields, values, buildSameAsFlags(fields));
};

/** Merge a saved draft onto current field defs (drops removed keys, keeps user edits) */
export const mergeDraftIntoForm = (fields, draft) => {
  const baseFlags = buildSameAsFlags(fields);
  const flags = { ...baseFlags };
  if (draft?.sameAsFlags) {
    fields.forEach((f) => {
      if (f.sameAsFieldKey && DATE_LINK_TYPES.has(f.dataType)) {
        if (typeof draft.sameAsFlags[f.key] === 'boolean') {
          flags[f.key] = draft.sameAsFlags[f.key];
        }
      }
    });
  }

  const values = {};
  fields.forEach((f) => {
    const isAuto = f.autoFill && f.autoFill !== 'none';
    if (isAuto) {
      values[f.key] = defaultValueForType(f.dataType, f.autoFill, f.allowMultiple);
      return;
    }
    if (draft?.values && Object.prototype.hasOwnProperty.call(draft.values, f.key)) {
      values[f.key] = draft.values[f.key];
      return;
    }
    values[f.key] = defaultValueForType(f.dataType, f.autoFill, f.allowMultiple);
  });

  return {
    values: applySameAsDefaults(fields, values, flags),
    flags,
  };
};

const isEmptyValue = (value) => {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string' && value.trim() === '') return true;
  if (Array.isArray(value) && value.length === 0) return true;
  return false;
};

export const validateRequiredFields = (fields, values) => {
  for (const field of fields) {
    if (!field.required) continue;
    if (field.autoFill && field.autoFill !== 'none') continue;
    if (isEmptyValue(values[field.key])) {
      return `${field.label} is required.`;
    }
  }
  return '';
};

/** Required + phone pattern checks for create/edit forms. */
export const validateFormFields = (fields, values) => {
  const requiredError = validateRequiredFields(fields, values);
  if (requiredError) return requiredError;
  for (const field of fields || []) {
    if (field.autoFill && field.autoFill !== 'none') continue;
    const phoneError = validatePhoneFieldValue(field, values?.[field.key]);
    if (phoneError) return phoneError;
  }
  return '';
};

