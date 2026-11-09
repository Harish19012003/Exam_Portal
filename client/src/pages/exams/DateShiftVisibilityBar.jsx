import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { buildDateShiftVisibilityGroups } from './dateShiftsConfig';

/**
 * Center list — toggle show/hide for dynamic shift column groups.
 * Click a chip (e.g. OP S4) to hide/show every date column for that shift.
 */
export const DateShiftVisibilityBar = ({
  dateShifts,
  fields,
  visibilityApiRef,
  onVisibilityChange,
}) => {
  const groups = useMemo(
    () => buildDateShiftVisibilityGroups(dateShifts, fields),
    [dateShifts, fields],
  );
  // Bump so chip active state re-reads table visibility after each toggle.
  const [tick, setTick] = useState(0);

  useEffect(() => {
    setTick((n) => n + 1);
  }, [dateShifts, fields, visibilityApiRef]);

  const visibility = useMemo(() => {
    void tick;
    return visibilityApiRef?.current?.getVisibility?.() || {};
  }, [tick, visibilityApiRef]);

  const isGroupShown = useCallback(
    (keys) => (keys || []).some((k) => visibility[k] !== false),
    [visibility],
  );

  const toggleGroup = useCallback(
    (group) => {
      const keys = group?.keys || [];
      if (!keys.length) return;
      const show = !isGroupShown(keys);
      const patch = {};
      keys.forEach((k) => {
        patch[k] = show;
      });
      visibilityApiRef?.current?.patchVisibility?.(patch);
      setTick((n) => n + 1);
      onVisibilityChange?.(patch);
    },
    [isGroupShown, visibilityApiRef, onVisibilityChange],
  );

  const showAll = useCallback(() => {
    const patch = {};
    groups.forEach((g) => {
      (g.keys || []).forEach((k) => {
        patch[k] = true;
      });
    });
    if (!Object.keys(patch).length) return;
    visibilityApiRef?.current?.patchVisibility?.(patch);
    setTick((n) => n + 1);
    onVisibilityChange?.(patch);
  }, [groups, visibilityApiRef, onVisibilityChange]);

  if (!groups.length) return null;

  const hiddenCount = groups.filter((g) => !isGroupShown(g.keys)).length;

  return (
    <div className="exam-shift-vis-bar" role="toolbar" aria-label="Show or hide shift columns">
      <span className="exam-shift-vis-bar-label">Shifts</span>
      <div className="exam-shift-vis-chips">
        {groups.map((group) => {
          const shown = isGroupShown(group.keys);
          return (
            <button
              key={group.id}
              type="button"
              className={`exam-shift-vis-chip${shown ? '' : ' is-hidden'}`}
              aria-pressed={shown}
              title={
                shown
                  ? `Hide all “${group.label}” columns`
                  : `Show all “${group.label}” columns`
              }
              onClick={() => toggleGroup(group)}
            >
              {shown ? <Eye size={12} aria-hidden="true" /> : <EyeOff size={12} aria-hidden="true" />}
              <span>{group.label}</span>
            </button>
          );
        })}
      </div>
      {hiddenCount > 0 && (
        <button type="button" className="exam-shift-vis-show-all" onClick={showAll}>
          Show all
        </button>
      )}
    </div>
  );
};
