import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, Info, Trash2, X } from 'lucide-react';
import { DynamicMultiDatePicker } from '../../components/DynamicData/fields';
import {
  allDayColumnLabel,
  buildDateShiftFields,
  buildDateShiftVisibilityGroups,
  hasDateShiftTemplate,
  hexWithAlpha,
  isDateShiftField,
  newDateShiftDate,
  normalizeColumnColor,
  normalizeDateShiftsConfig,
  resolveDateShiftsConfig,
  summaryColumnLabel,
} from './dateShiftsConfig';

/** Display title like 10-Nov-2026 from yyyy-mm-dd (or keep free text). */
export const formatDateShiftTitle = (raw) => {
  const s = String(raw || '').trim();
  if (!s) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return s;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = String(Number(m[3]));
  const mon = months[Number(m[2]) - 1] || m[2];
  const yy = m[1].slice(2);
  return `${day}-${mon}-${yy}`;
};

/**
 * Center list → pick exam dates only.
 * Shift format comes from this exam’s features or the Field preset.
 */
export const DateShiftsSelectModal = ({
  dateShifts = null,
  /** Optional Field presets for this exam page — used when the exam has no format yet. */
  presets = [],
  templateSource = null,
  /** Live Center-list fields — used with visibilityApiRef to hide/show shift columns. */
  fields = [],
  visibilityApiRef = null,
  onClose,
  onSave,
  saving = false,
}) => {
  const resolved = useMemo(() => {
    const fromExam = normalizeDateShiftsConfig(dateShifts);
    if (hasDateShiftTemplate(fromExam)) {
      return { config: fromExam, source: templateSource || 'exam' };
    }
    const presetHit = (Array.isArray(presets) ? presets : []).find((p) =>
      hasDateShiftTemplate(p?.features?.dateShifts),
    );
    if (presetHit) {
      return {
        config: resolveDateShiftsConfig(fromExam, presetHit.features.dateShifts),
        source: templateSource || `preset · ${presetHit.name}`,
      };
    }
    return { config: fromExam, source: null };
  }, [dateShifts, presets, templateSource]);

  const template = resolved.config;
  const hasTemplate = hasDateShiftTemplate(template);
  const sourceLabel = resolved.source;

  const [dates, setDates] = useState(() => (template.dates || []).map((d) => ({ ...d })));
  const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';
  const [error, setError] = useState('');

  const draftConfig = useMemo(
    () => normalizeDateShiftsConfig({ ...template, dates }),
    [template, dates],
  );
  const previewFields = useMemo(() => buildDateShiftFields(draftConfig), [draftConfig]);
  /** Prefer live fields; union preview keys so newly picked dates can still be toggled. */
  const visibilityFields = useMemo(() => {
    const live = (Array.isArray(fields) ? fields : []).filter(isDateShiftField);
    if (!live.length) return previewFields;
    const byKey = new Map(live.map((f) => [f.key, f]));
    previewFields.forEach((f) => {
      if (f?.key && !byKey.has(f.key)) byKey.set(f.key, f);
    });
    return [...byKey.values()];
  }, [fields, previewFields]);
  const visGroups = useMemo(
    () => buildDateShiftVisibilityGroups(draftConfig, visibilityFields),
    [draftConfig, visibilityFields],
  );
  const visGroupById = useMemo(() => {
    const map = new Map();
    visGroups.forEach((g) => map.set(g.id, g));
    return map;
  }, [visGroups]);
  const [visTick, setVisTick] = useState(0);
  /** Fallback when the table API is not mounted yet (preview-only / remount). */
  const [localHiddenKeys, setLocalHiddenKeys] = useState(() => new Set());
  useEffect(() => {
    setVisTick((n) => n + 1);
  }, [visibilityApiRef, visibilityFields]);
  useEffect(() => {
    // Push any local hides into the table once its visibility API is ready.
    const api = visibilityApiRef?.current;
    if (!api || !localHiddenKeys.size) return;
    const patch = {};
    localHiddenKeys.forEach((key) => {
      if (key) patch[key] = false;
    });
    if (Object.keys(patch).length) api.patchVisibility(patch);
  }, [visTick, visibilityApiRef, localHiddenKeys]);
  const columnVisibility = useMemo(() => {
    void visTick;
    return visibilityApiRef?.current?.getVisibility?.() || {};
  }, [visTick, visibilityApiRef]);
  const applyKeyVisibility = useCallback(
    (keys, show) => {
      const list = (keys || []).filter(Boolean);
      if (!list.length) return;
      const patch = {};
      list.forEach((k) => {
        patch[k] = show;
      });
      visibilityApiRef?.current?.patchVisibility?.(patch);
      setLocalHiddenKeys((prev) => {
        const next = new Set(prev);
        list.forEach((k) => {
          if (show) next.delete(k);
          else next.add(k);
        });
        return next;
      });
      setVisTick((n) => n + 1);
    },
    [visibilityApiRef],
  );
  const isKeyShown = useCallback(
    (key) => {
      if (!key) return true;
      if (localHiddenKeys.has(key)) return false;
      return columnVisibility[key] !== false;
    },
    [columnVisibility, localHiddenKeys],
  );
  const isGroupShown = useCallback(
    (groupId) => {
      const g = visGroupById.get(groupId);
      if (!g?.keys?.length) return true;
      return g.keys.some((k) => isKeyShown(k));
    },
    [visGroupById, isKeyShown],
  );
  const toggleGroup = useCallback(
    (groupId) => {
      const g = visGroupById.get(groupId);
      if (!g?.keys?.length) return;
      applyKeyVisibility(g.keys, !isGroupShown(groupId));
    },
    [visGroupById, isGroupShown, applyKeyVisibility],
  );
  const toggleFieldKey = useCallback(
    (key) => {
      if (!key) return;
      applyKeyVisibility([key], !isKeyShown(key));
    },
    [applyKeyVisibility, isKeyShown],
  );
  // One row per date (plus the all-day column), with labels shortened to the shift name.
  const previewGroups = useMemo(() => {
    const groups = [];
    const byDate = new Map();
    previewFields.forEach((f) => {
      const kind = f.dateShift?.kind;
      if (kind === 'allDay') {
        groups.unshift({ key: '__all', title: 'All days', items: [{ ...f, shortLabel: f.label }] });
        return;
      }
      const id = f.dateShift?.dateId || f.key;
      let group = byDate.get(id);
      if (!group) {
        group = { key: id, title: f.dateShift?.dateTitle || '', items: [] };
        byDate.set(id, group);
        groups.push(group);
      }
      const prefix = `${f.dateShift?.dateTitle} · `;
      group.items.push({
        ...f,
        shortLabel: f.label.startsWith(prefix) ? f.label.slice(prefix.length) : f.label,
      });
    });
    return groups;
  }, [previewFields]);
  const dirty = useMemo(
    () => JSON.stringify(dates.map((d) => ({ id: d.id, title: d.title }))) !==
      JSON.stringify((template.dates || []).map((d) => ({ id: d.id, title: d.title }))),
    [dates, template.dates],
  );

  const formatChips = useMemo(() => {
    const chips = [];
    if (template.allDayColumn?.enabled) {
      chips.push({
        key: 'allDay',
        groupId: 'allDay',
        label: allDayColumnLabel(template.allDayColumn),
        kind: 'max',
        color: normalizeColumnColor(template.allDayColumn.color),
      });
    }
    template.shifts.forEach((s) => {
      const shiftId = String(s?.id || '');
      chips.push({
        key: shiftId || s.label,
        groupId: shiftId ? `shift:${shiftId}` : null,
        label: s.label,
        kind: 'shift',
      });
    });
    if (template.summaryColumn?.enabled) {
      chips.push({
        key: 'summary',
        groupId: 'summary',
        label: `${summaryColumnLabel(template.summaryColumn)} Day N`,
        kind: 'max',
        color: normalizeColumnColor(template.summaryColumn.color),
      });
    }
    return chips;
  }, [template]);

  const chipStyle = (color) =>
    color
      ? { color, backgroundColor: hexWithAlpha(color, 0.14) }
      : undefined;

  /** Add every picked day at once; days that are already in the list are skipped. */
  const addDatesFromValues = (values) => {
    const existing = new Set(dates.map((d) => d.title.toLowerCase()));
    const fresh = [];
    const skipped = [];
    (values || []).forEach((raw) => {
      const title = formatDateShiftTitle(raw);
      if (!title) return;
      if (existing.has(title.toLowerCase())) {
        skipped.push(title);
        return;
      }
      existing.add(title.toLowerCase());
      fresh.push(newDateShiftDate(title));
    });
    if (fresh.length) setDates((prev) => [...prev, ...fresh]);
    setError(
      skipped.length
        ? `Already selected: ${skipped.join(', ')}`
        : '',
    );
  };

  const canApply =
    hasTemplate &&
    !saving &&
    dirty &&
    dates.some((d) => String(d.title || '').trim());

  const updateTitle = (id, title) =>
    setDates((prev) => prev.map((d) => (d.id === id ? { ...d, title } : d)));

  const removeDate = (id) => setDates((prev) => prev.filter((d) => d.id !== id));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!hasTemplate) return;
    const cleaned = dates
      .map((d) => ({ ...d, title: String(d.title || '').trim() }))
      .filter((d) => d.title);
    if (!cleaned.length && !(template.dates || []).length) {
      setError('Add at least one exam date.');
      return;
    }
    onSave?.(normalizeDateShiftsConfig({ ...template, dates: cleaned }));
  };

  return createPortal(
    <div className="exams-bulk-overlay" onClick={onClose}>
      <form
        className="exams-bulk-modal exams-date-shifts-select-modal"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        aria-label="Select exam dates"
      >
        <div className="exams-bulk-header">
          <div className="exams-bulk-heading">
            <h2 className="exams-bulk-title">
              <CalendarDays size={16} /> Select exam dates
            </h2>
            <p className="exams-bulk-sub">
              Each date gets your shift columns automatically
              {sourceLabel ? ` · format from ${sourceLabel}` : ''}.
            </p>
          </div>
          <button type="button" className="exams-drawer-close compact" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="exams-bulk-body exams-date-shifts-select-body">
          {!hasTemplate ? (
            <div className="exams-bulk-deps-empty">
              <CalendarDays size={22} aria-hidden="true" />
              <strong>No shift format found</strong>
              <span>
                On Settings → Field presets, open this service’s Center list preset → Bulk add →
                Date shifts, add shift names, Save changes, then save the preset. After that, pick
                dates here.
              </span>
            </div>
          ) : (
            <>
              <div className="exams-date-shifts-format-bar" aria-label="Shift format">
                <div className="exams-date-shifts-format-head">
                  <span className="exams-date-shifts-summary-label">Shift format</span>
                  <span
                    className="exams-bulk-tip"
                    title="Top chips hide/show a shift on every date. Chips in each date row hide/show that date’s column only. Apply still creates all columns — this only changes visibility."
                  >
                    <Info size={14} aria-hidden="true" />
                  </span>
                </div>
                <div className="exams-date-shifts-preview-subs" role="toolbar" aria-label="Hide or show shift columns">
                  {formatChips.map((chip) => {
                    const canToggle = Boolean(chip.groupId && visGroupById.get(chip.groupId)?.keys?.length);
                    const shown = !chip.groupId || isGroupShown(chip.groupId);
                    if (!canToggle) {
                      return (
                        <span
                          key={chip.key}
                          className={`exams-date-shifts-preview-chip${chip.kind === 'max' ? ' is-max' : ''}`}
                          style={chipStyle(chip.color)}
                        >
                          {chip.label}
                        </span>
                      );
                    }
                    return (
                      <button
                        key={chip.key}
                        type="button"
                        className={`exams-date-shifts-preview-chip exams-date-shifts-preview-chip--toggle${
                          chip.kind === 'max' ? ' is-max' : ''
                        }${shown ? '' : ' is-hidden'}`}
                        style={shown ? chipStyle(chip.color) : undefined}
                        aria-pressed={shown}
                        title={
                          shown
                            ? `Hide all “${chip.label}” columns on Center list`
                            : `Show all “${chip.label}” columns on Center list`
                        }
                        onClick={() => toggleGroup(chip.groupId)}
                      >
                        {chip.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="exams-date-shifts-select-toolbar">
                <div className="exams-date-shifts-select-picker">
                  <span className="exams-date-shifts-summary-label">Exam dates</span>
                  <DynamicMultiDatePicker
                    variant="form"
                    isDarkMode={isDarkMode}
                    placeholder="Pick one or more dates"
                    onChange={addDatesFromValues}
                  />
                </div>
              </div>

              {error && (
                <div className="exams-form-error" role="alert">
                  {error}
                </div>
              )}

              {dates.length === 0 ? (
                <div className="exams-date-shifts-select-empty">
                  <span className="exams-date-shifts-select-empty-icon" aria-hidden="true">
                    <CalendarDays size={22} />
                  </span>
                  <strong>No dates yet</strong>
                  <span>Pick one or more days above — columns are created per date from your format.</span>
                </div>
              ) : null}

              {previewFields.length > 0 && (
                <div className="exams-date-shifts-select-preview">
                  <span className="exams-date-shifts-summary-label">
                    Will create {previewFields.length} column{previewFields.length === 1 ? '' : 's'}
                  </span>
                  <div className="exams-date-shifts-preview-groups">
                    {previewGroups.map((g) => (
                      <div key={g.key} className="exams-date-shifts-preview-group">
                        {g.key === '__all' ? (
                          <span className="exams-date-shifts-preview-group-title">{g.title}</span>
                        ) : (
                          <label className="exams-date-shifts-preview-group-edit" title="Click to rename this date">
                            <CalendarDays size={14} aria-hidden="true" />
                            <input
                              type="text"
                              value={g.title}
                              onChange={(e) => updateTitle(g.key, e.target.value)}
                              aria-label={`Rename date ${g.title}`}
                            />
                          </label>
                        )}
                        <div
                          className="exams-date-shifts-preview-subs"
                          role="toolbar"
                          aria-label={`Hide or show columns for ${g.title}`}
                        >
                          {g.items.map((f) => {
                            const shown = isKeyShown(f.key);
                            const color = normalizeColumnColor(f.color);
                            return (
                              <button
                                key={f.key}
                                type="button"
                                className={`exams-date-shifts-preview-chip exams-date-shifts-preview-chip--toggle${
                                  shown ? '' : ' is-hidden'
                                }`}
                                style={shown ? chipStyle(color) : undefined}
                                aria-pressed={shown}
                                title={
                                  shown
                                    ? `Hide “${f.label}” on Center list`
                                    : `Show “${f.label}” on Center list`
                                }
                                onClick={() => toggleFieldKey(f.key)}
                              >
                                {f.shortLabel}
                              </button>
                            );
                          })}
                        </div>
                        {g.key !== '__all' && (
                          <button
                            type="button"
                            className="exams-bulk-remove exams-date-shifts-preview-group-remove"
                            onClick={() => removeDate(g.key)}
                            aria-label={`Remove date ${g.title}`}
                            title="Remove this date"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="exams-bulk-footer">
          <span className="exams-bulk-status">
            {hasTemplate
              ? `${dates.length} date${dates.length === 1 ? '' : 's'} · ${template.shifts.length} shift${template.shifts.length === 1 ? '' : 's'}${
                  dates.length ? ` · ${previewFields.length} columns` : ''
                }${dirty ? ' · unsaved' : ''}`
              : 'Save the shift format on the Field preset first'}
          </span>
          <div className="exams-bulk-footer-actions">
            <button type="button" className="exams-btn secondary compact" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="exams-btn primary compact"
              disabled={!canApply}
            >
              <CalendarDays size={14} />
              <span>{saving ? 'Saving…' : 'Apply columns'}</span>
            </button>
          </div>
        </div>
      </form>
    </div>,
    document.body,
  );
};
