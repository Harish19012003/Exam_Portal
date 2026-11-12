import React from 'react';
import { usePlatformSettings } from '../../hooks/usePlatformSettings';
import './AppFooter.css';

/**
 * Credit footer shown at the bottom of every page.
 * variant="bar"      → slim strip inside the dashboard layout (flex-shrink: 0)
 * variant="floating" → fixed to the viewport bottom for full-height public pages (login, 404…)
 * variant="inline"   → plain text, for embedding inside an existing footer
 */
/** Support email from Platform Settings. Only mounted inside the signed-in app shell (the API needs a login). */
const SupportLink = () => {
  const { settings } = usePlatformSettings();
  if (!settings.support_email) return null;
  return (
    <>
      <a className="app-footer-support" href={`mailto:${settings.support_email}`}>
        Support: {settings.support_email}
      </a>
      <span className="app-footer-sep" aria-hidden="true">·</span>
    </>
  );
};

export const AppFooter = ({ variant = 'bar' }) => (
  <footer className={`app-footer app-footer--${variant}`}>
    {variant === 'bar' && <SupportLink />}
    <span className="app-footer-name">Parameswaran</span>
  </footer>
);
