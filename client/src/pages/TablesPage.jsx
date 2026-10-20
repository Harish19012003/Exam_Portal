import React, { useState, useEffect } from 'react';
import { DynamicTable } from '../components/DynamicTable';
import { Table as TableIcon, Sparkles } from 'lucide-react';

export const TablesPage = () => {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return document.documentElement.getAttribute('data-theme') === 'dark' ||
           localStorage.getItem('theme') === 'dark';
  });

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDarkMode(document.documentElement.getAttribute('data-theme') === 'dark');
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  return (
    <div style={{ padding: '0', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
              Dynamic Table
            </h1>
            <span style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '4px', 
              fontSize: '11px', 
              fontWeight: '600', 
              padding: '3px 8px', 
              borderRadius: '12px', 
              backgroundColor: 'rgba(92, 67, 250, 0.12)', 
              color: 'var(--primary-color)' 
            }}>
              <Sparkles size={12} />
              Option A Default
            </span>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px', margin: 0 }}>
            Enterprise-grade data table imported from Option A with inline editing, smart aggregations, formula engine, and instant exports.
          </p>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: '650px' }}>
        <DynamicTable tableId="demo_tables" isDarkMode={isDarkMode} />
      </div>
    </div>
  );
};

export default TablesPage;
