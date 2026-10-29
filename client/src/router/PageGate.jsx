import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldOff } from 'lucide-react';
import { ACCESS_PAGES } from '@exam-view/shared';
import { useAccess } from '../hooks/useAccess';

/** Renders the page only if the user's groups / overrides allow it. */
export const PageGate = ({ page, children }) => {
  const { ready, canPage } = useAccess();
  if (!ready || canPage(page)) return children;

  const fallback = ACCESS_PAGES.find((p) => p.id !== page && canPage(p.id) && p.id !== 'users');
  return (
    <div className="page-gate" role="alert">
      <ShieldOff size={40} strokeWidth={1.6} aria-hidden="true" />
      <h2>No access to this page</h2>
      <p>Your groups don&apos;t include this page. Ask a Super Admin to add it to one of your groups.</p>
      {fallback && (
        <Link className="page-gate-link" to={fallback.path}>
          Go to {fallback.label}
        </Link>
      )}
    </div>
  );
};
