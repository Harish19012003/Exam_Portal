import { apiClient } from '../../api/client';

const unwrap = (response) => response?.data?.data ?? response?.data;

/** Field presets per service: { id, name, serviceValue, fields, fieldCount, features, updatedAt } */
export const listExamPresets = async () => {
  const rows = unwrap(await apiClient.get('/exam-presets'));
  return Array.isArray(rows) ? rows : [];
};

export const createExamPreset = async (preset) => unwrap(await apiClient.post('/exam-presets', preset));
export const updateExamPreset = async (id, preset) =>
  unwrap(await apiClient.patch(`/exam-presets/${id}`, preset));
export const deleteExamPreset = async (id) => unwrap(await apiClient.delete(`/exam-presets/${id}`));

/** Preset for a service value (same case-insensitive match the server uses), or null. */
export const findPresetForService = (presets, serviceValue) => {
  const wanted = String(serviceValue ?? '').trim().toLowerCase();
  if (!wanted) return null;
  return presets.find((p) => p.serviceValue.trim().toLowerCase() === wanted) || null;
};

/* ---------- Bringing an existing center list up to date with its preset ----------
 * A center list gets its own copy of the preset's fields when it is created, so later changes to
 * the preset (types, dropdown options, new fields) never reach it. These helpers compare the two
 * and merge the preset's definitions into the list by field key. Nothing is ever removed.
 */
const SETTINGS_KEYS = [
  'dataType',
  'options',
  'optionsSource',
  'configListId',
  'tableSource',
  'lookupGroup',
  'linkedFrom',
  'allowMultiple',
  'phoneValidation',
  'formula',
];

const settingsOf = (f) => JSON.stringify(SETTINGS_KEYS.map((k) => f?.[k] ?? null));

/** True when the fields both have appear in a different order than in the preset. */
const orderDiffers = (presetFields, fields) => {
  const inList = new Set(fields.map((f) => f.key));
  const wanted = presetFields.filter((pf) => inList.has(pf.key)).map((pf) => pf.key);
  const inPreset = new Set(wanted);
  const have = fields.filter((f) => inPreset.has(f.key)).map((f) => f.key);
  return wanted.some((key, i) => key !== have[i]);
};

/** { changed: [{ label, from, to }], added: [field], reordered } — what updating the list would do. */
export const diffPresetAgainstFields = (presetFields = [], fields = []) => {
  const byKey = new Map(fields.map((f) => [f.key, f]));
  const changed = [];
  const added = [];
  presetFields.forEach((pf) => {
    const current = byKey.get(pf.key);
    if (!current) added.push(pf);
    else if (settingsOf(pf) !== settingsOf(current)) {
      changed.push({ label: pf.label || pf.key, from: current.dataType, to: pf.dataType });
    }
  });
  return { changed, added, reordered: orderDiffers(presetFields, fields) };
};

/**
 * The list's fields with the preset's settings applied by key, in the preset's order, so fields that
 * sit together in the preset (a column group, say) sit together here. Fields that exist only in the
 * list are kept, after the preset's fields and in their own order.
 */
export const mergePresetIntoFields = (presetFields = [], fields = []) => {
  const listByKey = new Map(fields.map((f) => [f.key, f]));
  const presetKeys = new Set(presetFields.map((pf) => pf.key));

  const fromPreset = presetFields.map((pf) => {
    const current = listByKey.get(pf.key);
    if (!current) return { ...pf, id: `fld_${Date.now()}_${Math.random().toString(36).slice(2, 7)}` };
    const next = { ...current };
    SETTINGS_KEYS.forEach((k) => {
      if (pf[k] === undefined) delete next[k];
      else next[k] = pf[k];
    });
    return next;
  });
  const listOnly = fields.filter((f) => !presetKeys.has(f.key));
  return [...fromPreset, ...listOnly].map((f, i) => ({ ...f, order: i + 1 }));
};
