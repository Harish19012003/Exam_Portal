import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { InfoTip } from '../../components/PageHeading';
import { ArrowDown, ArrowUp, Plus, Search, Trash2, X } from 'lucide-react';
import { CENTER_CODE_KEY, DEFAULT_EXAM_VIEW, EXAM_VIEWS, examViewLabel } from '@exam-view/shared';
import { uniquePrefixedImportKey } from './examFieldTypes';
import { buildCombinedField, COMBINE_SEPARATORS, DEFAULT_COMBINE_SEPARATOR, separatorForLabel } from './examCombinedFields';
import {
  normalizeUniqueRowAggregates,
  normalizeUniqueRowKeys,
  UNIQUE_ROW_AGGREGATE_OPS,
  UNIQUE_ROW_WHERE_OPS,
  uniqueRowKeysLabel,
} from './examUniqueRows';
import {
  dateShiftSumSourceOptions,
  DATE_SHIFT_ALL_DAY_KEY,
} from './dateShiftsConfig';
import { getExamTable } from './examTableApi';
import { SearchableSelect } from './SearchableSelect';
import './ImportFieldsFromTabModal.css';

const newAggregateRule = (op = 'count') => ({
  id: `agg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
  op,
  targetKey: '',
  sourceKey: '',
  whereKey: '',
  whereOp: 'eq',
  whereValue: '',
  whereFormula: '',
});

const formulaForWhereKey = (whereKey, ...fieldLists) => {
  const key = String(whereKey || '').trim();
  if (!key) return '';
  for (const list of fieldLists) {
    const f = (Array.isArray(list) ? list : []).find((x) => x?.key === key);
    if (f?.dataType === 'formula' && String(f.formula || '').trim()) {
      return String(f.formula).trim();
    }
  }
  return '';
};

const presetLabel = (p) =>
  `${p.name || p.serviceValue} · ${examViewLabel(p.view || DEFAULT_EXAM_VIEW)}`;

/** Deduplicate select options by value — duplicate keys break React list updates / search. */
const uniqueSelectOptions = (list = []) => {
  const seen = new Set();
  const out = [];
  for (const opt of list) {
    const value = String(opt?.value || '').trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push({ ...opt, value });
  }
  return out;
};

/**
 * Inline searchable picker for Unique-import calculations.
 * Avoids the portaled SearchableSelect (search was not filtering there).
 */
const CalcFieldPicker = ({
  value = '',
  options = [],
  onChange,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  ariaLabel = 'Pick field',
  allowClear = false,
}) => {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [menuPos, setMenuPos] = useState(null);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const inputRef = useRef(null);

  const safeOptions = useMemo(() => {
    const list = uniqueSelectOptions(options);
    const v = String(value || '').trim();
    // Keep a saved key visible even if the current FROM source no longer lists it.
    if (v && !list.some((o) => o.value === v)) {
      return [...list, { value: v, label: `${v} (saved)` }];
    }
    return list;
  }, [options, value]);
  const selected = safeOptions.find((o) => o.value === value) || null;
  const needle = q.trim().toLowerCase();
  const filtered = !needle
    ? safeOptions
    : safeOptions.filter((o) => {
        const hay = `${o.label || ''} ${o.value || ''}`.toLowerCase();
        return hay.includes(needle);
      });

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      const t = e.target;
      if (rootRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
      setQ('');
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) {
      setMenuPos(null);
      return undefined;
    }
    const place = () => {
      const r = triggerRef.current.getBoundingClientRect();
      const width = Math.max(r.width, 240);
      const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8));
      const spaceAbove = r.top - 12;
      const maxHeight = Math.max(160, Math.min(300, spaceAbove));
      setMenuPos({
        left,
        width,
        maxHeight,
        bottom: window.innerHeight - r.top + 4,
      });
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [open]);

  useEffect(() => {
    if (open) {
      const t = window.setTimeout(() => inputRef.current?.focus(), 10);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [open]);

  const menu = open && menuPos ? (
    <div
      ref={menuRef}
      className="import-calc-pick-menu is-fixed"
      role="listbox"
      style={menuPos}
    >
      <label className="import-calc-pick-search">
        <Search size={13} aria-hidden="true" />
        <input
          ref={inputRef}
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          autoComplete="off"
        />
        {q ? (
          <button
            type="button"
            className="import-calc-pick-clear"
            onClick={() => {
              setQ('');
              inputRef.current?.focus();
            }}
            aria-label="Clear search"
          >
            <X size={12} />
          </button>
        ) : null}
      </label>
      <ul className="import-calc-pick-list">
        {allowClear && !needle ? (
          <li>
            <button
              type="button"
              role="option"
              aria-selected={!value}
              className={`import-calc-pick-option${!value ? ' is-selected' : ''}`}
              onClick={() => {
                onChange?.('');
                setOpen(false);
                setQ('');
              }}
            >
              {placeholder}
            </button>
          </li>
        ) : null}
        {filtered.length ? (
          filtered.map((opt) => (
            <li key={opt.value}>
              <button
                type="button"
                role="option"
                aria-selected={opt.value === value}
                className={`import-calc-pick-option${opt.value === value ? ' is-selected' : ''}`}
                onClick={() => {
                  onChange?.(opt.value);
                  setOpen(false);
                  setQ('');
                }}
              >
                {opt.label}
              </button>
            </li>
          ))
        ) : (
          <li className="import-calc-pick-empty">
            {needle ? `No matches for “${q.trim()}”` : 'No options'}
          </li>
        )}
      </ul>
    </div>
  ) : null;

  return (
    <div className={`import-calc-pick${open ? ' is-open' : ''}`} ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="import-calc-pick-trigger"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => {
          setOpen((v) => !v);
          setQ('');
        }}
      >
        <span className={selected ? '' : 'is-placeholder'}>
          {selected?.label || placeholder}
        </span>
      </button>
      {menu ? createPortal(menu, document.body) : null}
    </div>
  );
};

/**
 * Pick fields from another exam tab (live exam) or from another field preset (Settings).
 * Optional: combine 2+ source fields into one read-only joined column.
 */
export const ImportFieldsFromTabModal = ({
  open,
  examId = null,
  currentView,
  currentFields = [],
  /** Other presets to import from (Settings → Field presets). */
  presetSources = null,
  /** Prefill source preset when opened from the rail dropdown. */
  initialPresetId = '',
  /** Existing unique-import config so the user can re-edit it. */
  existingUniqueRowKeys = null,
  existingUniqueRowAggregates = null,
  /** Open scrolled to the Unique import panel (Edit unique import). */
  focusUnique = false,
  onClose,
  onImport,
}) => {
  const presetMode = Array.isArray(presetSources) && !examId;
  // The parent rebuilds `presetSources` / `tabOptions` on every render. Read them through refs so a
  // re-render never resets the user's ticks; only opening the dialog or changing the source does.
  const presetSourcesRef = useRef(presetSources);
  presetSourcesRef.current = presetSources;
  const currentKeys = useMemo(() => new Set(currentFields.map((f) => f.key)), [currentFields]);

  const tabOptions = useMemo(
    () => EXAM_VIEWS.filter((v) => v.key !== currentView),
    [currentView],
  );
  const firstTabKey = tabOptions[0]?.key || DEFAULT_EXAM_VIEW;

  const [sourceView, setSourceView] = useState(tabOptions[0]?.key || DEFAULT_EXAM_VIEW);
  const [sourcePresetId, setSourcePresetId] = useState(presetSources?.[0]?.id || '');
  const [sourceFields, setSourceFields] = useState([]);
  /** Date×shift template from the source tab/preset (e.g. Max all day on Center list format). */
  const [sourceDateShifts, setSourceDateShifts] = useState(null);
  /** Ordered selection (tick order = join / unique-key order by default). */
  const [selectedOrder, setSelectedOrder] = useState([]);
  const [combineMode, setCombineMode] = useState(false);
  /** Selected fields also define a composite unique row key (e.g. State + City + Vendor). */
  const [uniqueMode, setUniqueMode] = useState(false);
  /** Count / sum results written onto this page’s fields for each unique group. */
  const [aggregateRules, setAggregateRules] = useState([]);
  const [combineLabel, setCombineLabel] = useState('');
  const [combineSeparator, setCombineSeparator] = useState(DEFAULT_COMBINE_SEPARATOR);
  const [separatorChoice, setSeparatorChoice] = useState('comma'); // a COMBINE_SEPARATORS id, or 'custom'
  const [query, setQuery] = useState('');
  /** Search box for the source-column list in Unique import. */
  const [srcQuery, setSrcQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const uniquePanelRef = useRef(null);

  const seedUniqueKeys = useMemo(
    () => normalizeUniqueRowKeys(existingUniqueRowKeys),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(normalizeUniqueRowKeys(existingUniqueRowKeys))],
  );
  const seedAggregates = useMemo(
    () => normalizeUniqueRowAggregates(existingUniqueRowAggregates),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(normalizeUniqueRowAggregates(existingUniqueRowAggregates))],
  );
  const seedUniqueKeysSig = seedUniqueKeys.join('|');
  const seedAggregatesSig = JSON.stringify(seedAggregates);
  /** Only re-seed when the modal opens — not when parent features refresh mid-edit. */
  const seededOpenRef = useRef(false);

  useEffect(() => {
    if (!open) {
      seededOpenRef.current = false;
      return undefined;
    }
    if (seededOpenRef.current) return undefined;
    seededOpenRef.current = true;
    setSourceView(firstTabKey);
    {
      const list = presetSourcesRef.current || [];
      const wanted = String(initialPresetId || '').trim();
      const hit = wanted && list.find((p) => String(p.id) === wanted);
      setSourcePresetId(hit ? String(hit.id) : list[0]?.id || '');
    }
    setCombineMode(false);
    setCombineLabel('');
    setCombineSeparator(DEFAULT_COMBINE_SEPARATOR);
    setSeparatorChoice('comma');
    setQuery('');
    setSrcQuery('');
    setError('');
    // Re-open existing unique import for editing, or when opened via “Unique import”.
    if (seedUniqueKeys.length || focusUnique) {
      setUniqueMode(true);
      setSelectedOrder(seedUniqueKeys);
      setAggregateRules(
        seedAggregates.map((r) => ({
          ...newAggregateRule(r.op),
          op: r.op,
          targetKey: r.targetKey,
          sourceKey: r.sourceKey || '',
          whereKey: r.whereKey || '',
          whereOp: r.whereOp || 'eq',
          whereValue: r.whereValue || '',
          whereFormula: r.whereFormula || '',
        })),
      );
    } else {
      setUniqueMode(false);
      setSelectedOrder([]);
      setAggregateRules([]);
    }
    return undefined;
    // seed*Sig captures content; seed arrays themselves are intentionally omitted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, firstTabKey, seedUniqueKeysSig, seedAggregatesSig, focusUnique]);

  useEffect(() => {
    if (!open || !uniqueMode) return undefined;
    if (!focusUnique && !seedUniqueKeys.length) return undefined;
    const t = window.setTimeout(() => {
      uniquePanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 80);
    return () => window.clearTimeout(t);
  }, [open, uniqueMode, focusUnique, seedUniqueKeysSig]);

  // Fill whereFormula once page/source fields are available (fixes "final_mock (saved)").
  useEffect(() => {
    if (!open || !uniqueMode) return;
    setAggregateRules((prev) => {
      let changed = false;
      const next = prev.map((r) => {
        if (!r.whereKey || String(r.whereFormula || '').trim()) return r;
        const whereFormula = formulaForWhereKey(r.whereKey, currentFields, sourceFields);
        if (!whereFormula) return r;
        changed = true;
        return { ...r, whereFormula };
      });
      return changed ? next : prev;
    });
  }, [open, uniqueMode, currentFields, sourceFields]);

  useEffect(() => {
    if (!open) return undefined;
    let alive = true;

    const applySourceList = (list, dateShifts = null) => {
      setSourceFields(list);
      setSourceDateShifts(dateShifts);
      // Keep / restore unique-key selection against the loaded source.
      setSelectedOrder((prev) => {
        const preferred = (prev.length ? prev : seedUniqueKeys).filter((k) =>
          list.some((f) => f.key === k),
        );
        if (seedUniqueKeys.length) return preferred;
        // Switching source preset/tab while editing clears ticks that aren't on the new source.
        return preferred;
      });
    };

    if (presetMode) {
      const preset = (presetSourcesRef.current || []).find((p) => String(p.id) === String(sourcePresetId));
      const list = Array.isArray(preset?.fields) ? preset.fields : [];
      applySourceList(list, preset?.features?.dateShifts || null);
      setLoading(false);
      setError('');
      return () => {
        alive = false;
      };
    }

    if (!examId || !sourceView) return undefined;
    setLoading(true);
    setError('');
    getExamTable(examId, sourceView)
      .then((snap) => {
        if (!alive) return;
        const list = Array.isArray(snap?.fields) ? snap.fields : [];
        applySourceList(list, snap?.features?.dateShifts || null);
      })
      .catch(() => {
        if (!alive) return;
        setSourceFields([]);
        setSourceDateShifts(null);
        setError('Could not load fields from that tab.');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [open, examId, sourceView, sourcePresetId, presetMode]);

  useEffect(() => {
    if (selectedOrder.length < 2 && combineMode) setCombineMode(false);
  }, [selectedOrder, combineMode]);

  useEffect(() => {
    if (!combineMode || combineLabel.trim()) return;
    const labels = selectedOrder
      .map((key) => sourceFields.find((f) => f.key === key)?.label || key)
      .filter(Boolean);
    if (labels.length >= 2) setCombineLabel(labels.join(separatorForLabel(combineSeparator)));
  }, [combineMode, selectedOrder, sourceFields, combineSeparator, combineLabel]);

  const targetFieldOptions = useMemo(() => {
    const list = Array.isArray(currentFields) ? currentFields : [];
    return uniqueSelectOptions(
      list
        .filter((f) => f?.key)
        .map((f) => ({
          value: f.key,
          label: `${f.label || f.key} (${f.key})`,
        })),
    );
  }, [currentFields]);
  const sourceFieldOptions = useMemo(() => {
    const fromDateShifts = dateShiftSumSourceOptions(sourceDateShifts, sourceFields);
    const fromFields = (sourceFields || [])
      .filter((f) => f?.key)
      .map((f) => ({
        value: f.key,
        label: `${f.label || f.key} (${f.key})`,
      }));
    // Date-shift columns (Max all day, shifts, day summaries) first so Sum of… finds them.
    return uniqueSelectOptions([...fromDateShifts, ...fromFields]);
  }, [sourceFields, sourceDateShifts]);
  /** Where should prefer fields you can see on this page (incl. formulas), then source columns. */
  const whereFieldOptions = useMemo(() => {
    const pageFields = (Array.isArray(currentFields) ? currentFields : [])
      .filter((f) => f?.key)
      .map((f) => ({
        value: f.key,
        label: `${f.label || f.key} (${f.key})${f.dataType === 'formula' ? ' · formula' : ''}`,
      }));
    return uniqueSelectOptions([...pageFields, ...sourceFieldOptions]);
  }, [currentFields, sourceFieldOptions]);
  const uniqueKeysPreview = uniqueRowKeysLabel(sourceFields, selectedOrder);
  const uniqueKeyAddOptions = useMemo(
    () =>
      uniqueSelectOptions(
        (sourceFields || [])
          .filter((f) => f?.key && !selectedOrder.includes(f.key))
          .map((f) => ({
            value: f.key,
            label: `${f.label || f.key} (${f.key})`,
          })),
      ),
    [sourceFields, selectedOrder],
  );

  const incompleteAggregateIds = useMemo(() => {
    const bad = new Set();
    for (const r of aggregateRules) {
      if (!String(r.targetKey || '').trim()) bad.add(r.id);
      else if (r.op === 'sum' && !String(r.sourceKey || '').trim()) bad.add(r.id);
    }
    return bad;
  }, [aggregateRules]);

  if (!open) return null;

  const selected = new Set(selectedOrder);
  const toggle = (key) => {
    setSelectedOrder((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  };
  const addUniqueKey = (key) => {
    const k = String(key || '').trim();
    if (!k) return;
    setSelectedOrder((prev) => (prev.includes(k) ? prev : [...prev, k]));
  };
  const addSumFor = (key) => {
    setAggregateRules((prev) => [...prev, { ...newAggregateRule('sum'), sourceKey: key }]);
  };
  const srcQ = srcQuery.trim().toLowerCase();
  const sumSourceKeys = new Set(aggregateRules.map((r) => r.sourceKey).filter(Boolean));
  const sourceListFields = (sourceFields || []).filter(
    (f) => f?.key && (!srcQ || `${f.label || ''} ${f.key}`.toLowerCase().includes(srcQ)),
  );
  const removeUniqueKey = (key) => {
    setSelectedOrder((prev) => prev.filter((k) => k !== key));
  };

  const movePart = (key, dir) => {
    setSelectedOrder((prev) => {
      const i = prev.indexOf(key);
      if (i < 0) return prev;
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  // Normal import lists every source field (clashing keys are renamed on import).
  // Combine / unique can also use fields already on this page.
  const baseFields = sourceFields;
  const q = query.trim().toLowerCase();
  const filteredFields = q
    ? baseFields.filter((f) => `${f.label || ''} ${f.key}`.toLowerCase().includes(q))
    : baseFields;
  // Unique edit: already-imported fields first so State / City / Vendor are easy to find.
  const listFields = uniqueMode
    ? [...filteredFields].sort((a, b) => {
      const aHere = currentKeys.has(a.key) ? 0 : 1;
      const bHere = currentKeys.has(b.key) ? 0 : 1;
      if (aHere !== bHere) return aHere - bHere;
      const aSel = selected.has(a.key) ? 0 : 1;
      const bSel = selected.has(b.key) ? 0 : 1;
      return aSel - bSel;
    })
    : filteredFields;
  const alreadyHere = sourceFields.filter((f) => currentKeys.has(f.key));
  const sourceHomeView = presetMode
    ? (presetSources || []).find((p) => String(p.id) === String(sourcePresetId))?.view || DEFAULT_EXAM_VIEW
    : sourceView;
  const resolveSourceLabel = () => {
    if (!presetMode) return examViewLabel(sourceHomeView);
    const sourcePreset = (presetSources || []).find((p) => String(p.id) === String(sourcePresetId));
    return (
      String(sourcePreset?.name || sourcePreset?.serviceValue || '').trim() ||
      examViewLabel(sourceHomeView)
    );
  };

  const patchAggregateRule = (id, patch) => {
    setAggregateRules((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const next = { ...r, ...patch };
        // Writing to All Day Max without Sum of → default to Max all day from the source.
        if (
          next.op === 'sum' &&
          !String(next.sourceKey || '').trim() &&
          /all_?day.*max|max.*all_?day/i.test(String(next.targetKey || ''))
        ) {
          const allDay =
            sourceFieldOptions.find((o) => o.value === DATE_SHIFT_ALL_DAY_KEY) ||
            sourceFieldOptions.find((o) => /allday|all_day/i.test(String(o.value || '')));
          if (allDay) next.sourceKey = allDay.value;
        }
        return next;
      }),
    );
  };

  const handleImport = () => {
    if (!selectedOrder.length) {
      setError(
        uniqueMode
          ? 'Select the unique key fields (including ones already on this page).'
          : 'Select at least one field to import.',
      );
      return;
    }

    if (combineMode) {
      if (selectedOrder.length < 2) {
        setError('Pick at least two fields to combine.');
        return;
      }
      try {
        const sourceLabel = resolveSourceLabel();
        const combinedField = buildCombinedField({
          label: combineLabel,
          keys: selectedOrder,
          separator: combineSeparator,
          sourceView: sourceHomeView,
          takenKeys: [...currentKeys],
          sourceFields,
        });
        onImport?.({
          combinedField: { ...combinedField, sharedFromLabel: sourceLabel },
          sourceView: sourceHomeView,
          sourceLabel,
        });
        onClose?.();
      } catch (err) {
        setError(err?.message || 'Could not build the combined column.');
      }
      return;
    }

    const uniqueRowKeys = uniqueMode ? normalizeUniqueRowKeys(selectedOrder) : [];
    if (
      uniqueMode &&
      aggregateRules.some(
        (r) =>
          String(r.whereKey || '').trim() &&
          (r.whereOp === 'eq' || r.whereOp === 'neq' || !r.whereOp) &&
          !String(r.whereValue || '').trim(),
      )
    ) {
      setError('Where equals / not equals needs a condition value (e.g. Yes).');
      return;
    }
    // Auto-fill Sum of → Max all day when Write to is All Day Max (same as patch helper).
    const preparedRules = uniqueMode
      ? aggregateRules.map((r) => {
          if (
            r.op === 'sum' &&
            !String(r.sourceKey || '').trim() &&
            /all_?day.*max|max.*all_?day/i.test(String(r.targetKey || ''))
          ) {
            const allDay =
              sourceFieldOptions.find((o) => o.value === DATE_SHIFT_ALL_DAY_KEY) ||
              sourceFieldOptions.find((o) => /allday|all_day/i.test(String(o.value || '')));
            if (allDay) return { ...r, sourceKey: allDay.value };
          }
          return r;
        })
      : aggregateRules;
    if (uniqueMode && preparedRules.some((r) => r.sourceKey !== aggregateRules.find((x) => x.id === r.id)?.sourceKey)) {
      setAggregateRules(preparedRules);
    }

    if (
      uniqueMode &&
      preparedRules.some(
        (r) =>
          !String(r.targetKey || '').trim() ||
          (r.op === 'sum' && !String(r.sourceKey || '').trim()),
      )
    ) {
      const missingSumOf = preparedRules.some(
        (r) => r.op === 'sum' && !String(r.sourceKey || '').trim(),
      );
      setError(
        missingSumOf
          ? 'Sum needs a “Sum of” field (e.g. Max all day). Pick it under Sum of, or delete that Sum row with the trash icon.'
          : 'Each calculation needs a “Write to” field on this page.',
      );
      return;
    }

    const draftedAggregates = uniqueMode
      ? preparedRules.map((r) => {
          const whereKey = r.whereKey;
          const whereFormula =
            String(r.whereFormula || '').trim() ||
            formulaForWhereKey(whereKey, currentFields, sourceFields);
          return {
            op: r.op,
            targetKey: r.targetKey,
            sourceKey: r.sourceKey,
            whereKey,
            whereOp: r.whereOp,
            whereValue: r.whereValue,
            ...(whereFormula ? { whereFormula } : {}),
          };
        })
      : [];
    const uniqueRowAggregates = uniqueMode
      ? normalizeUniqueRowAggregates(draftedAggregates)
      : [];
    if (uniqueMode && preparedRules.length && uniqueRowAggregates.length !== preparedRules.length) {
      setError('Each calculation needs a “Write to” field; Sum also needs “Sum of”.');
      return;
    }
    const sourceLabel = resolveSourceLabel();
    const pickedByKey = new Map();
    const taken = new Set(currentKeys);
    let renamedCount = 0;
    for (const key of selectedOrder) {
      const f = sourceFields.find((x) => x.key === key);
      if (!f) continue;
      // Unique import only pulls in keys that are not already on this page.
      if (uniqueMode) {
        if (!currentKeys.has(f.key)) pickedByKey.set(f.key, f);
        continue;
      }
      // Never duplicate the shared center identity column.
      if (f.key === CENTER_CODE_KEY && currentKeys.has(f.key)) continue;
      if (!taken.has(f.key)) {
        pickedByKey.set(f.key, f);
        taken.add(f.key);
        continue;
      }
      // Same key already on page → independent copy with a source-prefixed key.
      const newKey = uniquePrefixedImportKey(f.key, sourceLabel, taken);
      const { sharedFromView: _priorHome, ...rest } = f;
      pickedByKey.set(newKey, {
        ...rest,
        key: newKey,
        sharedFromView: undefined,
        sharedFromLabel: sourceLabel,
        importRenamedFrom: f.key,
      });
      taken.add(newKey);
      renamedCount += 1;
    }
    // Sum sources that are real columns can travel with the import.
    // Max all day (ds_allday) is resolved from Center date-shifts at rollup — do not
    // invent a Formula field on this page (it had no formula text and blocked Save).
    if (uniqueMode) {
      for (const rule of uniqueRowAggregates) {
        if (rule.op !== 'sum' || !rule.sourceKey || currentKeys.has(rule.sourceKey)) continue;
        if (pickedByKey.has(rule.sourceKey)) continue;
        if (rule.sourceKey === DATE_SHIFT_ALL_DAY_KEY || /allday/i.test(rule.sourceKey)) continue;
        const fromSource = sourceFields.find((f) => f.key === rule.sourceKey);
        if (fromSource) pickedByKey.set(fromSource.key, fromSource);
      }
    }
    const picked = Array.from(pickedByKey.values());
    if (!picked.length && !uniqueRowKeys.length) {
      setError(
        uniqueMode
          ? 'Select at least one field that is not already on this page.'
          : 'Select at least one field to import.',
      );
      return;
    }
    if (uniqueMode && uniqueRowKeys.length < 1) {
      setError('Pick at least one field for the unique key.');
      return;
    }
    onImport?.({
      fields: picked,
      sourceView: sourceHomeView,
      sourceLabel,
      renamedCount,
      ...(uniqueMode
        ? {
            uniqueRowKeys,
            // Always send aggregates in unique mode (including []) so parent can persist Where.
            uniqueRowAggregates,
          }
        : {}),
    });
    onClose?.();
  };

  return createPortal(
    <div className="import-fields-overlay" onClick={onClose} role="presentation">
      <div
        className="import-fields-modal"
        role="dialog"
        aria-modal="true"
        aria-label={presetMode ? 'Import fields from another preset' : 'Import fields from another tab'}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="import-fields-header">
          <div>
            <h2 className="import-fields-title">
              {presetMode ? 'Import fields from another preset' : 'Import fields from another tab'}
              <InfoTip title="About importing" label="About importing fields">
                Unique import: pick group-by keys (e.g. State · City · Vendor), then map Count / Sum onto
                columns on this page. Sum sources like Final Mock are chosen in Calculations — they are not
                unique keys. Or turn Unique import off and tick fields to copy columns, or combine 2+ into one.
              </InfoTip>
            </h2>
          </div>
          <button type="button" className="import-fields-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>

        <div className="import-fields-controls">
          {presetMode ? (
            (presetSources || []).length === 0 ? (
              <p className="import-fields-empty">
                Create at least one other preset first (e.g. Center list for this service), then import its columns here.
              </p>
            ) : (
              <div className="import-fields-source">
                <span>From</span>
                <SearchableSelect
                  ariaLabel="Source preset"
                  value={String(sourcePresetId)}
                  onChange={(v) => setSourcePresetId(v)}
                  options={(presetSources || []).map((p) => ({
                    value: String(p.id),
                    label: `${presetLabel(p)} (${p.fieldCount ?? p.fields?.length ?? 0} fields)`,
                  }))}
                  searchPlaceholder="Search presets…"
                />
              </div>
            )
          ) : (
            <div className="import-fields-source">
              <span>From</span>
              <SearchableSelect
                ariaLabel="Source tab"
                value={sourceView}
                onChange={(v) => setSourceView(v)}
                options={tabOptions.map((v) => ({ value: v.key, label: v.label }))}
              />
            </div>
          )}

          <label className="import-fields-combine-toggle import-fields-mode-toggle">
            <input
              type="checkbox"
              checked={uniqueMode}
              onChange={(e) => {
                const on = e.target.checked;
                setUniqueMode(on);
                if (on) {
                  setCombineMode(false);
                  setQuery('');
                }
              }}
            />
            <span>Unique import</span>
          </label>

          {!uniqueMode && sourceFields.length > 6 && (
            <label className="import-fields-search">
              <Search size={14} aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search fields…"
                aria-label="Search fields"
              />
            </label>
          )}
        </div>

        {error && (
          <p className="import-fields-error" role="alert">
            {error}
          </p>
        )}

        {uniqueMode ? (
          <div className="import-fields-unique-split">
            <aside className="import-fields-src" aria-label="Source columns">
              <div className="import-fields-src-head">
                <span className="import-fields-src-title">Source columns</span>
                <span className="import-fields-src-count">{sourceListFields.length} of {sourceFields.length}</span>
              </div>
              <label className="import-fields-src-search">
                <Search size={14} aria-hidden="true" />
                <input
                  type="search"
                  value={srcQuery}
                  onChange={(e) => setSrcQuery(e.target.value)}
                  placeholder="Search columns…"
                  aria-label="Search source columns"
                  autoComplete="off"
                />
              </label>
              <ul className="import-fields-src-list">
                {loading ? (
                  <li className="import-fields-empty">Loading…</li>
                ) : sourceListFields.length === 0 ? (
                  <li className="import-fields-empty">{srcQ ? 'No columns match.' : 'No columns.'}</li>
                ) : (
                  sourceListFields.map((f) => {
                    const isKey = selectedOrder.includes(f.key);
                    const isSum = sumSourceKeys.has(f.key);
                    return (
                      <li key={f.key} className={`import-fields-src-row${isKey ? ' is-key' : ''}${isSum ? ' is-sum' : ''}`}>
                        <span className="import-fields-src-name">
                          <span className="import-fields-src-label">{f.label || f.key}</span>
                          <code>{f.key}</code>
                        </span>
                        <span className="import-fields-src-actions">
                          <button
                            type="button"
                            className={`import-fields-src-btn${isKey ? ' is-on' : ''}`}
                            disabled={isKey}
                            onClick={() => addUniqueKey(f.key)}
                            title={isKey ? 'Already a unique key' : 'Add as unique key'}
                            aria-label={`Add ${f.label || f.key} as unique key`}
                          >
                            {isKey ? 'Key ✓' : '+ Key'}
                          </button>
                          <button
                            type="button"
                            className={`import-fields-src-btn${isSum ? ' is-on' : ''}`}
                            onClick={() => addSumFor(f.key)}
                            title="Add a Sum calculation for this column"
                            aria-label={`Add Sum of ${f.label || f.key}`}
                          >
                            {isSum ? 'Sum ✓' : '+ Sum'}
                          </button>
                        </span>
                      </li>
                    );
                  })
                )}
              </ul>
            </aside>
          <div className="import-fields-unique-flow" ref={uniquePanelRef}>
            <section className="import-fields-step" aria-labelledby="import-unique-keys-heading">
              <header className="import-fields-step-head">
                <span className="import-fields-step-badge">1</span>
                <div className="import-fields-step-titles">
                  <h3 id="import-unique-keys-heading" className="import-fields-step-title">
                    Group by (unique keys)
                  </h3>
                  <p className="import-fields-step-hint">
                    One row per combination — e.g. State · City · Vendor. Do not add Final Mock or other
                    values you want to sum here.
                  </p>
                </div>
              </header>
              {loading ? (
                <p className="import-fields-empty">Loading…</p>
              ) : (
                <>
                  <div className="import-fields-parts" role="list" aria-label="Unique key order">
                    {!selectedOrder.length ? (
                      <p className="import-fields-skip">No keys yet — add State, City, Vendor Name, etc.</p>
                    ) : (
                      selectedOrder.map((key, index) => {
                        const field = sourceFields.find((f) => f.key === key);
                        return (
                          <div key={key} className="import-fields-part" role="listitem">
                            <span className="import-fields-part-index" aria-hidden="true">
                              {index + 1}
                            </span>
                            <span className="import-fields-part-label">
                              {field?.label || key}
                              <code>{key}</code>
                              {currentKeys.has(key) ? (
                                <span className="import-fields-badge on-page">on page</span>
                              ) : null}
                            </span>
                            <span className="import-fields-part-actions">
                              <button
                                type="button"
                                className="import-fields-part-btn"
                                disabled={index === 0}
                                onClick={() => movePart(key, -1)}
                                aria-label={`Move ${field?.label || key} up`}
                              >
                                <ArrowUp size={14} />
                              </button>
                              <button
                                type="button"
                                className="import-fields-part-btn"
                                disabled={index === selectedOrder.length - 1}
                                onClick={() => movePart(key, 1)}
                                aria-label={`Move ${field?.label || key} down`}
                              >
                                <ArrowDown size={14} />
                              </button>
                              <button
                                type="button"
                                className="import-fields-part-btn"
                                onClick={() => removeUniqueKey(key)}
                                aria-label={`Remove ${field?.label || key} from unique keys`}
                                title="Remove from unique keys"
                              >
                                <Trash2 size={14} />
                              </button>
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                  <div className="import-fields-add-key">
                    <SearchableSelect
                      ariaLabel="Add unique key field"
                      value=""
                      portal
                      onChange={(key) => addUniqueKey(key)}
                      options={uniqueKeyAddOptions}
                      searchPlaceholder="Add unique key field…"
                      placeholder="Add unique key field…"
                    />
                  </div>
                  {uniqueKeysPreview ? (
                    <p className="import-fields-key-preview">
                      Key: <strong>{uniqueKeysPreview}</strong>
                    </p>
                  ) : null}
                </>
              )}
            </section>

            <section className="import-fields-step is-calc" aria-labelledby="import-unique-calc-heading">
              <header className="import-fields-step-head">
                <span className="import-fields-step-badge">2</span>
                <div className="import-fields-step-titles">
                  <h3 id="import-unique-calc-heading" className="import-fields-step-title">
                    Calculations
                  </h3>
                  <p className="import-fields-step-hint">
                    Map Count / Sum onto columns on this page. Optional <strong>Where</strong> counts only
                    matching centers (e.g. Final Mock equals Yes).
                  </p>
                </div>
                <div className="import-fields-agg-actions">
                  <button
                    type="button"
                    className="import-fields-agg-add"
                    onClick={() => setAggregateRules((prev) => [...prev, newAggregateRule('count')])}
                  >
                    <Plus size={14} />
                    Count
                  </button>
                  <button
                    type="button"
                    className="import-fields-agg-add"
                    onClick={() => setAggregateRules((prev) => [...prev, newAggregateRule('sum')])}
                  >
                    <Plus size={14} />
                    Sum
                  </button>
                </div>
              </header>

              {!aggregateRules.length ? (
                <p className="import-fields-skip">
                  Optional. Example: Count where Mock Done equals Yes → Mock Done · Sum of Final Mock → a
                  number column.
                </p>
              ) : (
                <div className="import-fields-calc-list" role="list" aria-label="Calculation mappings">
                  <div className="import-fields-calc-head" aria-hidden="true">
                    <span>Type</span>
                    <span>Sum of (from source)</span>
                    <span>Write to (this page)</span>
                    <span />
                  </div>
                  {aggregateRules.map((rule) => {
                    const whereOp = rule.whereOp || 'eq';
                    const needsWhereValue = whereOp === 'eq' || whereOp === 'neq';
                    const rowIncomplete = incompleteAggregateIds.has(rule.id);
                    const missingSumOf =
                      rule.op === 'sum' && !String(rule.sourceKey || '').trim();
                    const missingTarget = !String(rule.targetKey || '').trim();
                    return (
                      <div
                        key={rule.id}
                        className={`import-fields-agg-row is-mapped${rowIncomplete ? ' is-incomplete' : ''}`}
                        role="listitem"
                      >
                        <div className="import-fields-agg-main">
                          <div className="import-fields-agg-cell is-type">
                          <span className="import-fields-agg-cap">Type</span>
                          <SearchableSelect
                            ariaLabel="Result type"
                            value={rule.op}
                            searchThreshold={99}
                            portal
                            onChange={(op) =>
                              patchAggregateRule(rule.id, {
                                op,
                                sourceKey: op === 'sum' ? rule.sourceKey : '',
                              })
                            }
                            options={UNIQUE_ROW_AGGREGATE_OPS.map((o) => ({
                              value: o.value,
                              label: o.label,
                            }))}
                          />
                          </div>
                          <div className={`import-fields-agg-cell is-source${missingSumOf ? ' is-missing' : ''}`}>
                          <span className="import-fields-agg-cap">Sum of</span>
                          {rule.op === 'sum' ? (
                            <CalcFieldPicker
                              ariaLabel="Source field to sum"
                              value={rule.sourceKey}
                              onChange={(sourceKey) => patchAggregateRule(rule.id, { sourceKey })}
                              options={sourceFieldOptions}
                              searchPlaceholder="Search source… e.g. mock"
                              placeholder="Sum of… (required)"
                            />
                          ) : (
                            <span className="import-fields-calc-na">— (row count)</span>
                          )}
                          </div>
                          <button
                            type="button"
                            className="import-fields-part-btn import-fields-agg-remove"
                            onClick={() =>
                              setAggregateRules((prev) => prev.filter((r) => r.id !== rule.id))
                            }
                            aria-label="Remove calculation"
                            title="Remove calculation"
                          >
                            <Trash2 size={14} />
                          </button>
                          <div className={`import-fields-agg-cell is-target${missingTarget ? ' is-missing' : ''}`}>
                          <span className="import-fields-agg-cap">Write to (this page)</span>
                          <CalcFieldPicker
                            ariaLabel="Target field on this page"
                            value={rule.targetKey}
                            onChange={(targetKey) => patchAggregateRule(rule.id, { targetKey })}
                            options={targetFieldOptions}
                            searchPlaceholder="Search this page…"
                            placeholder="Write to… (required)"
                          />
                          </div>
                        </div>
                        {rowIncomplete ? (
                          <p className="import-fields-agg-row-error" role="alert">
                            {missingSumOf
                              ? 'Pick “Sum of” (e.g. Max all day), or remove this Sum with the trash icon.'
                              : 'Pick “Write to” on this page, or remove this calculation.'}
                          </p>
                        ) : null}
                        <div className="import-fields-agg-where">
                          <span className="import-fields-agg-where-label">Only rows where</span>
                          <CalcFieldPicker
                            ariaLabel="Condition field"
                            value={rule.whereKey || ''}
                            allowClear
                            onChange={(whereKey) =>
                              patchAggregateRule(rule.id, {
                                whereKey,
                                whereOp: whereKey ? rule.whereOp || 'eq' : 'eq',
                                whereValue: whereKey ? rule.whereValue || '' : '',
                                whereFormula: whereKey
                                  ? formulaForWhereKey(whereKey, currentFields, sourceFields)
                                  : '',
                              })
                            }
                            options={whereFieldOptions}
                            searchPlaceholder="Search condition field…"
                            placeholder="Any row (no filter)"
                          />
                          <SearchableSelect
                            ariaLabel="Condition operator"
                            value={whereOp}
                            searchThreshold={99}
                            portal
                            disabled={!rule.whereKey}
                            onChange={(nextOp) =>
                              patchAggregateRule(rule.id, {
                                whereOp: nextOp,
                                whereValue:
                                  nextOp === 'eq' || nextOp === 'neq' ? rule.whereValue || '' : '',
                              })
                            }
                            options={UNIQUE_ROW_WHERE_OPS.map((o) => ({
                              value: o.value,
                              label: o.label,
                            }))}
                          />
                          {needsWhereValue ? (
                            <input
                              type="text"
                              className="import-fields-agg-where-value"
                              aria-label="Condition value"
                              placeholder="Value… e.g. Yes"
                              value={rule.whereValue || ''}
                              disabled={!rule.whereKey}
                              onChange={(e) =>
                                patchAggregateRule(rule.id, { whereValue: e.target.value })
                              }
                            />
                          ) : (
                            <span className="import-fields-calc-na is-where-na">—</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {!targetFieldOptions.length ? (
                <p className="import-fields-skip">
                  Add number fields on this page first (e.g. Days Total Center, Final Mock Sum), then map
                  results here.
                </p>
              ) : null}
            </section>
          </div>
          </div>
        ) : (
          <>
            <div className="import-fields-list" role="group" aria-label="Fields to import">
              {loading ? (
                <p className="import-fields-empty">Loading…</p>
              ) : !sourceFields.length ? (
                <p className="import-fields-empty">
                  {presetMode ? 'That preset has no fields yet.' : `“${examViewLabel(sourceView)}” has no fields yet.`}
                </p>
              ) : !listFields.length ? (
                <p className="import-fields-empty">
                  {q ? 'No fields match your search.' : 'No fields to show.'}
                </p>
              ) : (
                listFields.map((f) => {
                  const onPage = currentKeys.has(f.key);
                  const willRename = !combineMode && onPage && f.key !== CENTER_CODE_KEY;
                  return (
                    <label key={f.key} className="import-fields-row">
                      <input
                        type="checkbox"
                        checked={selected.has(f.key)}
                        onChange={() => toggle(f.key)}
                        disabled={!combineMode && onPage && f.key === CENTER_CODE_KEY}
                      />
                      <span className="import-fields-label">{f.label || f.key}</span>
                      <code className="import-fields-key">{f.key}</code>
                      {f.key === CENTER_CODE_KEY && <span className="import-fields-badge">shared key</span>}
                      {willRename && (
                        <span
                          className="import-fields-badge on-page"
                          title="Key already used — import will prefix the key from the source name"
                        >
                          rename key
                        </span>
                      )}
                      {combineMode && selected.has(f.key) && (
                        <span className="import-fields-ord">#{selectedOrder.indexOf(f.key) + 1}</span>
                      )}
                    </label>
                  );
                })
              )}
              {!combineMode && alreadyHere.length > 0 && (
                <p className="import-fields-skip">
                  Fields marked <strong>rename key</strong> keep your label; the key gets a source prefix
                  (e.g. <code>frisking_vendor_name</code>).
                </p>
              )}
            </div>

            {(selectedOrder.length >= 1 || alreadyHere.length > 0) && (
              <div className="import-fields-combine">
                {selectedOrder.length >= 2 && (
                  <label className="import-fields-combine-toggle">
                    <input
                      type="checkbox"
                      checked={combineMode}
                      onChange={(e) => {
                        const on = e.target.checked;
                        setCombineMode(on);
                        if (on) setUniqueMode(false);
                      }}
                    />
                    <span>Combine into one column</span>
                  </label>
                )}
                {combineMode && (
                  <>
                    <label className="import-fields-source">
                      <span>Combined column name</span>
                      <input
                        type="text"
                        value={combineLabel}
                        onChange={(e) => setCombineLabel(e.target.value)}
                        placeholder="e.g. Center address"
                        maxLength={120}
                      />
                    </label>
                    <div className="import-fields-source">
                      <span>Separator</span>
                      <SearchableSelect
                        ariaLabel="Separator"
                        value={separatorChoice}
                        searchThreshold={99}
                        onChange={(id) => {
                          setSeparatorChoice(id);
                          const preset = COMBINE_SEPARATORS.find((o) => o.id === id);
                          setCombineSeparator(preset ? preset.value : '');
                        }}
                        options={[
                          ...COMBINE_SEPARATORS.map((o) => ({ value: o.id, label: o.label })),
                          { value: 'custom', label: 'Custom…' },
                        ]}
                      />
                    </div>
                    {separatorChoice === 'custom' && (
                      <label className="import-fields-source">
                        <span>Custom separator</span>
                        <input
                          type="text"
                          value={combineSeparator}
                          onChange={(e) => setCombineSeparator(e.target.value)}
                          placeholder="e.g.  ::  or  →"
                          maxLength={12}
                          autoFocus
                        />
                      </label>
                    )}
                    <div className="import-fields-parts" role="list" aria-label="Join order">
                      <span className="import-fields-parts-label">Join order</span>
                      {selectedOrder.map((key, index) => {
                        const field = sourceFields.find((f) => f.key === key);
                        return (
                          <div key={key} className="import-fields-part" role="listitem">
                            <span className="import-fields-part-label">
                              {field?.label || key}
                              <code>{key}</code>
                            </span>
                            <span className="import-fields-part-actions">
                              <button
                                type="button"
                                className="import-fields-part-btn"
                                disabled={index === 0}
                                onClick={() => movePart(key, -1)}
                                aria-label={`Move ${field?.label || key} up`}
                              >
                                <ArrowUp size={14} />
                              </button>
                              <button
                                type="button"
                                className="import-fields-part-btn"
                                disabled={index === selectedOrder.length - 1}
                                onClick={() => movePart(key, 1)}
                                aria-label={`Move ${field?.label || key} down`}
                              >
                                <ArrowDown size={14} />
                              </button>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    <p className="import-fields-skip">
                      Only the combined column is added — source columns stay on {examViewLabel(sourceHomeView)}.
                      Empty parts are skipped at display time.
                    </p>
                  </>
                )}
              </div>
            )}
          </>
        )}

        <footer className="import-fields-footer">
          <span className="import-fields-count" aria-live="polite">
            {uniqueMode
              ? `${selectedOrder.length} unique key${selectedOrder.length === 1 ? '' : 's'}${
                  aggregateRules.length
                    ? ` · ${aggregateRules.length} calculation${aggregateRules.length === 1 ? '' : 's'}`
                    : ''
                }`
              : selectedOrder.length
                ? `${selectedOrder.length} selected`
                : 'None selected'}
          </span>
          <button type="button" className="import-fields-btn secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="import-fields-btn primary"
            onClick={handleImport}
            disabled={loading || selectedOrder.length === 0 || (combineMode && selectedOrder.length < 2)}
          >
            {combineMode
              ? 'Add combined column'
              : uniqueMode
                ? 'Save unique import'
                : `Import ${selectedOrder.length || ''} field${selectedOrder.length === 1 ? '' : 's'}`}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
};
