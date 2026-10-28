import React, { useState } from 'react';
import { Info } from 'lucide-react';
import './PageHeading.css';

/**
 * Title block used by every page: heading, optional subtitle, optional info tooltip,
 * optional leading element (e.g. a back button). Use this alone when the page already
 * has its own toolbar; otherwise use <PageHeading>.
 */
export const PageTitle = ({ title, subtitle, info, leading }) => {
  const [infoOpen, setInfoOpen] = useState(false);

  return (
    <div className="page-title-block">
      {leading}
      <div className="page-title-group">
        <div className="page-title-row">
          <h1 className="page-title">{title}</h1>
          {info ? (
            <div
              className="page-info-wrap"
              onMouseEnter={() => setInfoOpen(true)}
              onMouseLeave={() => setInfoOpen(false)}
            >
              <button
                type="button"
                className={`page-info-btn${infoOpen ? ' active' : ''}`}
                onClick={() => setInfoOpen((open) => !open)}
                aria-label={`About ${typeof title === 'string' ? title : 'this page'}`}
                aria-expanded={infoOpen}
              >
                <Info size={15} />
              </button>
              {infoOpen && (
                <div className="page-info-popover" role="tooltip">
                  <div className="page-info-popover-head">
                    <Info size={13} />
                    <span>About {typeof title === 'string' ? title : 'this page'}</span>
                  </div>
                  <p>{info}</p>
                </div>
              )}
            </div>
          ) : null}
        </div>
        {subtitle ? <p className="page-subtitle">{subtitle}</p> : null}
      </div>
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
