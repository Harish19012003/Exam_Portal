import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LayoutList } from 'lucide-react';
import { EXAM_VIEWS } from '@exam-view/shared';
import { examPath } from './examUrl';
import { SearchableSelect } from './SearchableSelect';
import './ExamSubNav.css';

export const EXAM_SUB_PAGES = EXAM_VIEWS.map((v) => ({
  key: v.key,
  label: v.label,
  path: v.key,
}));

/** Dropdown switcher between the sub pages of an exam (Center list, Mock Day, Exam Day, …). */
export const ExamSubNav = ({ examId }) => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const current = decodeURIComponent(pathname.split('/').filter(Boolean).pop() || '');
  const active = EXAM_SUB_PAGES.find((p) => p.path === current) || EXAM_SUB_PAGES[0];

  return (
    <div className="exam-subnav" aria-label="Exam sections">
      <span className="exam-subnav-icon" aria-hidden="true">
        <LayoutList size={14} strokeWidth={2.25} />
      </span>
      <SearchableSelect
        ariaLabel="Exam section"
        value={active.key}
        options={EXAM_SUB_PAGES.map((p) => ({ value: p.key, label: p.label }))}
        searchThreshold={Number.MAX_SAFE_INTEGER}
        portal
        onChange={(key) => {
          const page = EXAM_SUB_PAGES.find((p) => p.key === key);
          if (page && page.key !== active.key) navigate(examPath(examId, page.path));
        }}
      />
    </div>
  );
};
