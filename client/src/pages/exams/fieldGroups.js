import { importedSourceLabel, isSharedImportedField, primarySourceName } from '@exam-view/shared';
import { isCombinedField } from './examCombinedFields';
import { isLinkedField, isTableSourceField } from './tableLookupApi';

/**
 * Groups a field list for the full-page field builder rail (Settings → Field presets → Edit):
 * where each field came from (own vs imported per source preset) and which dependencies it has.
 * Also builds a reverse "used by" index so a row can show which fields rely on it.
 */

export const FIELD_GROUP_ALL = 'all';
export const FIELD_GROUP_DETAILS = 'details';

const formulaRefs = (formula) => {
  const out = new Set();
  String(formula || '').replace(/\{([^{}]+)\}/g, (_, key) => {
    out.add(String(key).trim());
    return '';
  });
  return out;
};

/** True when a field was brought in from another tab / preset (shown with the imported badge). */
export const isImportedField = (field) =>
  isSharedImportedField(field) || isCombinedField(field) || Boolean(field?.sharedFromLabel);

export const isPhoneMatchField = (field) =>
  field?.dataType === 'phone' && Boolean(field.lookupTable) && Boolean(field.lookupColumn);

/**
 * key → [{ key, label, how }] — fields that read from / reference this field.
 * how: 'fills' (linked value), 'formula', 'same as', 'combined'.
 */
export const buildUsedByIndex = (fields) => {
  const index = new Map();
  const add = (targetKey, field, how) => {
    if (!targetKey || targetKey === field.key) return;
    if (!index.has(targetKey)) index.set(targetKey, []);
    const list = index.get(targetKey);
    if (!list.some((u) => u.key === field.key && u.how === how)) {
      list.push({ key: field.key, label: field.label || field.key, how });
    }
  };
  (fields || []).forEach((f) => {
    if (!f?.key) return;
    if (isLinkedField(f)) add(f.linkedFrom.fieldKey, f, 'fills');
    if (f.dataType === 'formula') formulaRefs(f.formula).forEach((k) => add(k, f, 'formula'));
    if (f.sameAsFieldKey) add(f.sameAsFieldKey, f, 'same as');
    if (isCombinedField(f)) (f.combine?.keys || []).forEach((k) => add(k, f, 'combined'));
  });
  return index;
};

const hasDependency = (f, usedBy) =>
  isLinkedField(f) ||
  isTableSourceField(f) ||
  isPhoneMatchField(f) ||
  f.dataType === 'formula' ||
  Boolean(f.sameAsFieldKey) ||
  isCombinedField(f) ||
  (usedBy.get(f.key)?.length ?? 0) > 0;

/**
 * Rail sections. Each item: { id, label, title, kind, ids: Set<fieldId>, hint }.
 * Empty dependency groups are dropped so the rail only lists what this preset actually uses.
 */
export const buildFieldGroups = (fields, { presets = [], currentServiceValue = '', uniqueRowKeys = [] } = {}) => {
  const list = Array.isArray(fields) ? fields : [];
  const usedBy = buildUsedByIndex(list);
  const idsOf = (pred) => new Set(list.filter(pred).map((f) => f.id));
  const uniqueKeys = new Set(Array.isArray(uniqueRowKeys) ? uniqueRowKeys : []);

  // Imported — one item per source preset / tab name.
  const bySource = new Map();
  list.forEach((f) => {
    if (!isImportedField(f)) return;
    const src = importedSourceLabel(f, { presets, preferredService: currentServiceValue }) || 'Other source';
    if (!bySource.has(src)) bySource.set(src, new Set());
    bySource.get(src).add(f.id);
  });

  const fieldsSection = {
    id: 'fields',
    title: 'Fields',
    items: [
      { id: FIELD_GROUP_ALL, label: 'All fields', kind: 'all', ids: new Set(list.map((f) => f.id)) },
      {
        id: 'own',
        label: 'Preset fields',
        kind: 'own',
        ids: idsOf((f) => !isImportedField(f)),
        hint: 'Defined in this preset',
      },
    ],
  };

  const importedSection = {
    id: 'imported',
    title: 'Imported from',
    items: [...bySource.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([src, ids]) => {
        const srcName = primarySourceName(src) || src;
        const preset =
          (Array.isArray(presets) ? presets : []).find(
            (p) => primarySourceName(p?.name) === srcName || String(p?.name || '').trim() === srcName,
          ) || null;
        return {
          id: `src:${src}`,
          label: src,
          kind: 'source',
          ids,
          presetId: preset?.id ? String(preset.id) : '',
          hint: `Shared from ${src} — edit them on that preset. Add / Bulk add imports more from there.`,
        };
      }),
  };

  const depItems = [
    {
      id: 'dep:any',
      label: 'All with dependencies',
      kind: 'dependency',
      ids: idsOf((f) => hasDependency(f, usedBy)),
      hint: 'Reads from, or is read by, another field or table',
    },
    {
      id: 'dep:phone',
      label: 'Phone match',
      kind: 'phone',
      ids: idsOf(isPhoneMatchField),
      hint: 'Phone number looked up in a table row',
    },
    {
      id: 'dep:linked',
      label: 'Linked values',
      kind: 'linked',
      ids: idsOf((f) => isLinkedField(f) || (usedBy.get(f.key) || []).some((u) => u.how === 'fills')),
      hint: 'Filled from the row picked by a phone / table field',
    },
    {
      id: 'dep:table',
      label: 'Table lookups',
      kind: 'table',
      ids: idsOf((f) => f.optionsSource === 'table'),
      hint: 'Options read from a database table',
    },
    {
      id: 'dep:config',
      label: 'Config lists',
      kind: 'config',
      ids: idsOf((f) => f.optionsSource === 'config'),
      hint: 'Options from Settings → Config dropdown lists',
    },
    {
      id: 'dep:tags',
      label: 'User tags',
      kind: 'tags',
      ids: idsOf((f) => f.optionsSource === 'userTags'),
      hint: 'Options are users filtered by tag',
    },
    {
      id: 'dep:exam',
      label: 'From exam',
      kind: 'exam',
      ids: idsOf((f) => f.dataType === 'fromExam'),
      hint: 'Mirrors a value from the parent exam',
    },
    {
      id: 'dep:formula',
      label: 'Formulas',
      kind: 'formula',
      ids: idsOf((f) => f.dataType === 'formula' || (usedBy.get(f.key) || []).some((u) => u.how === 'formula')),
      hint: 'Formula fields and the fields they use',
    },
    {
      id: 'dep:combined',
      label: 'Combined',
      kind: 'combined',
      ids: idsOf((f) => isCombinedField(f) || (usedBy.get(f.key) || []).some((u) => u.how === 'combined')),
      hint: 'Combined columns and their parts',
    },
    {
      id: 'dep:same',
      label: 'Same-as / auto',
      kind: 'same',
      ids: idsOf((f) => Boolean(f.sameAsFieldKey) || (f.autoFill && f.autoFill !== 'none')),
      hint: 'Copies or auto-fills its value',
    },
  ].filter((item) => item.ids.size > 0);

  const rulesItems = [
    {
      id: 'rule:unique',
      label: 'Unique row keys',
      kind: 'unique',
      ids: idsOf((f) => uniqueKeys.has(f.key) || f.unique),
      hint: 'Together identify one row on import',
    },
    { id: 'rule:required', label: 'Required', kind: 'required', ids: idsOf((f) => f.required) },
  ].filter((item) => item.ids.size > 0);

  return {
    usedBy,
    sections: [
      fieldsSection,
      importedSection.items.length ? importedSection : null,
      depItems.length ? { id: 'deps', title: 'Dependencies', items: depItems } : null,
      rulesItems.length ? { id: 'rules', title: 'Rules', items: rulesItems } : null,
    ].filter(Boolean),
  };
};
