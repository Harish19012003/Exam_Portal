import React, { useState, useEffect } from 'react';
import { DynamicViewsView } from './DynamicViewsView';

/**
 * Default dynamic views surface — Table / List / Card / Kanban / Tree / Calendar
 * ported from Dashboard-Option-A (source left unchanged; copy lives under client/src).
 */
export const TablesPage = () => {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return (
      document.documentElement.getAttribute('data-theme') === 'dark' ||
      localStorage.getItem('theme') === 'dark'
    );
  });

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDarkMode(document.documentElement.getAttribute('data-theme') === 'dark');
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    return () => observer.disconnect();
  }, []);

  return (
    <div
      className="tables-page--dynamic"
      style={{
        padding: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        flex: 1,
        minHeight: 0,
        height: '100%',
        overflow: 'hidden',
      }}
    >
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <DynamicViewsView isDarkMode={isDarkMode} />
      </div>
    </div>
  );
};

export default TablesPage;
