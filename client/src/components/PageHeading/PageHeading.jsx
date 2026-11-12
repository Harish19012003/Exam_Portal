import React from 'react';
import { InfoTip } from './InfoTip';
import './PageHeading.css';

/**
 * Title block used by every page: heading, optional subtitle, optional info tooltip,
 * optional leading element (e.g. a back button). Use this alone when the page already
 * has its own toolbar; otherwise use <PageHeading>.
 * Omit `title` to show only leading/actions (e.g. exam sub-pages that use ExamSubNav).
 */
export const PageTitle = ({ title, subtitle, info, leading }) => {
  const hasTitle = title != null && title !== '';
  const about = typeof title === 'string' && title ? title : 'this page';

  return (
    <div className="page-title-block">
      {leading}
      {(hasTitle || subtitle || info) ? (
        <div className="page-title-group">
          {(hasTitle || info) ? (
            <div className="page-title-row">
              {hasTitle ? <h1 className="page-title">{title}</h1> : null}
              {info ? (
                <InfoTip title={`About ${about}`} label={`About ${about}`}>
                  {info}
                </InfoTip>
              ) : null}
            </div>
          ) : null}
          {subtitle ? <p className="page-subtitle">{subtitle}</p> : null}
        </div>
      ) : null}
    </div>
  );
};

/** Standard page heading bar: title block on the left, `actions` on the right. */
export const PageHeading = ({ title, subtitle, info, leading, actions, className = '' }) => (
  <div className={`page-heading ${className}`.trim()}>
    <PageTitle title={title} subtitle={subtitle} info={info} leading={leading} />
    {actions ? <div className="page-heading-actions">{actions}</div> : null}
  </div>
);
