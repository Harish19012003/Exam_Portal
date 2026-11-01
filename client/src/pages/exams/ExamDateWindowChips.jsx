import React from 'react';
import { EXAM_DATE_WINDOWS } from './examDateWindow';
import './ExamDateWindowChips.css';

/** Segmented date-window control for Exam management. */
export function ExamDateWindowChips({
  value = 'all',
  onChange,
  disabled = false,
  counts = null,
}) {
  return (
    <div className="exam-date-windows">
      <span className="exam-date-windows__label" id="exam-date-windows-label">
        Schedule
      </span>
      <div
        className="exam-date-windows__track"
        role="tablist"
        aria-labelledby="exam-date-windows-label"
      >
        {EXAM_DATE_WINDOWS.map((w) => {
          const active = value === w.id;
          const count = counts && typeof counts[w.id] === 'number' ? counts[w.id] : null;
          return (
            <button
              key={w.id}
              type="button"
              role="tab"
              aria-selected={active}
              disabled={disabled}
              className={`exam-date-windows__chip${active ? ' is-active' : ''}`}
              onClick={() => {
                if (!active) onChange?.(w.id);
              }}
            >
              <span className="exam-date-windows__text">{w.label}</span>
              {count != null && (
                <span className="exam-date-windows__count" aria-hidden="true">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
