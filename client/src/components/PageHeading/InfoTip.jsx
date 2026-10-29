import React, { useState } from 'react';
import { Info } from 'lucide-react';
import './PageHeading.css';

/** Info icon that shows `children` in a popover on hover, or on click / tap. */
export const InfoTip = ({ title, label, children, className = '' }) => {
  const [open, setOpen] = useState(false);

  return (
    <div
      className={`page-info-wrap ${className}`.trim()}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className={`page-info-btn${open ? ' active' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-label={label || title || 'More information'}
        aria-expanded={open}
      >
        <Info size={15} />
      </button>
      {open && (
        <div className="page-info-popover" role="tooltip">
          {title ? (
            <div className="page-info-popover-head">
              <Info size={13} />
              <span>{title}</span>
            </div>
          ) : null}
          <p>{children}</p>
        </div>
      )}
    </div>
  );
};
