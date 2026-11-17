import React from 'react';
import { CheckCircle2, CircleDashed } from 'lucide-react';

const SHIFT_COLUMNS = [
  { role: 'shift', label: 'Count' },
  { role: 'shiftStatus', label: 'Status' },
  { role: 'shiftFirstT', label: 'First T.' },
  { role: 'shiftLastT', label: 'Last T.' },
];

const DAY_ROLES = ['examDate', 'maxDayN', 'maxStatus'];

function Cell({ item, showLabel = false, plain = false }) {
  if (!item) return <span className="exams-edc-empty">—</span>;
  const key = item.matchedKey || item.key;
  const state = item.present ? 'is-present' : item.required ? 'is-missing' : 'is-optional';
  const tip = [
    item.label,
    `key: ${key}`,
    `type: ${item.dataType}`,
    item.present ? 'present' : item.required ? 'missing' : 'optional · not added',
    item.hint,
  ]
    .filter(Boolean)
    .join('\n');
  return (
    <span className={`exams-edc-cell ${state}${plain ? ' is-plain' : ''}`} title={tip}>
      {item.present ? (
        <CheckCircle2 size={13} aria-label="Present" />
      ) : (
        <CircleDashed size={13} aria-label={item.required ? 'Missing' : 'Optional'} />
      )}
      {showLabel ? <span className="exams-edc-cell-label">{item.label}</span> : null}
      <code>{key}</code>
      {showLabel && !item.required ? <span className="exams-edc-opt">optional</span> : null}
    </span>
  );
}

/**
 * Compact checklist for Center list → Exam Day import columns:
 * shift × role matrix beside a per-day field card.
 */
export default function ExamDayImportChecklist({ plan, id }) {
  const items = plan?.items || [];
  const dayItems = DAY_ROLES.map((r) => items.find((it) => it.role === r)).filter(Boolean);
  const shifts = plan?.shiftSuggestions || [];
  const byShift = (shiftId, role) =>
    items.find((it) => it.role === role && String(it.examDayShiftId) === String(shiftId));

  return (
    <div id={id} className="exams-edc">
      {shifts.length ? (
        <div className="exams-edc-table-wrap">
          <table className="exams-edc-table">
            <thead>
              <tr>
                <th scope="col">Shift</th>
                {SHIFT_COLUMNS.map((c) => (
                  <th key={c.role} scope="col">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shifts.map((s) => {
                const cells = SHIFT_COLUMNS.map((c) => byShift(s.id, c.role));
                const done = cells.filter((it) => it?.present).length;
                return (
                  <tr key={s.id}>
                    <th scope="row">
                      <span className="exams-edc-shift">{s.label}</span>
                      <span
                        className={`exams-edc-progress${
                          done === cells.length ? ' is-done' : done ? ' is-partial' : ''
                        }`}
                        title={`${done} of ${cells.length} columns added`}
                      >
                        {done === cells.length ? <CheckCircle2 size={11} aria-hidden="true" /> : null}
                        {done}/{cells.length}
                      </span>
                    </th>
                    {cells.map((it, i) => (
                      <td key={SHIFT_COLUMNS[i].role}>
                        <Cell item={it} plain />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      <div className="exams-edc-day" role="group" aria-label="Day-level columns">
        <span className="exams-edc-section">Per day</span>
        <ul className="exams-edc-day-list">
          {dayItems.map((it) => (
            <li key={it.id}>
              <Cell item={it} showLabel plain />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
