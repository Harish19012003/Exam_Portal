import React from 'react';
import './AppFooter.css';

/**
 * Credit footer shown at the bottom of every page.
 * variant="bar"      → slim strip inside the dashboard layout (flex-shrink: 0)
 * variant="floating" → fixed to the viewport bottom for full-height public pages (login, 404…)
 * variant="inline"   → plain text, for embedding inside an existing footer
 */
export const AppFooter = ({ variant = 'bar' }) => (
  <footer className={`app-footer app-footer--${variant}`}>
    <span className="app-footer-name">Parameswaran</span>
  </footer>
);
