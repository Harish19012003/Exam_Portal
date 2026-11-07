import React from 'react';
import { NavLink } from 'react-router-dom';
import { EXAM_VIEWS } from '@exam-view/shared';
import { examPath } from './examUrl';
import './ExamSubNav.css';

export const EXAM_SUB_PAGES = EXAM_VIEWS.map((v) => ({
  key: v.key,
  label: v.label,
  path: v.key,
}));

/** Switcher between the sub pages of an exam (Center list, Mock Day, Exam Day). */
export const ExamSubNav = ({ examId }) => {
  return (
    <nav className="exam-subnav" aria-label="Exam sections">
      {EXAM_SUB_PAGES.map((p) => (
        <NavLink
          key={p.key}
          to={examPath(examId, p.path)}
          end
          className={({ isActive }) => `exam-subnav-item ${isActive ? 'active' : ''}`}
        >
          {p.label}
        </NavLink>
      ))}
    </nav>
  );
};
