import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Icon } from '@iconify/react';
import { Search } from 'lucide-react';
import type { ViewFeatureItem } from './viewFeatures';
import { groupFeaturesBySection } from './viewFeatures';
import { ViewCornerFabStack, cornerFabClass } from './ViewCornerFabs';
import { FeatureBuilderPanel, SectionLabel, ToggleRow } from './FeatureBuilderParts';

export interface ViewFeatureBuilderProps {
  isDarkMode: boolean;
  isOpen: boolean;
  onToggleOpen: () => void;
  onClose: () => void;
  items: ViewFeatureItem[];
  values: Record<string, boolean | undefined>;
  onToggle: (key: string) => void;
  title?: string;
  subtitle?: string;
  /**
   * Per-feature config panels (e.g. Summary Chips editor).
   * Shown only when that feature is ON and the gear is clicked.
   */
  featureConfig?: Record<string, ReactNode>;
  /** @deprecated Prefer featureConfig — extras always render and stay open. */
  extras?: ReactNode;
  cornerExtras?: ReactNode;
  cornerExpanded?: boolean;
}

export function ViewFeatureBuilder({
  isDarkMode,
  isOpen,
  onToggleOpen,
  onClose,
  items,
  values,
  onToggle,
  title = 'Feature Builder',
  subtitle = 'Grouped by what you want to do. Shared = every supporting view.',
  featureConfig,
  extras,
  cornerExtras,
  cornerExpanded = false,
}: ViewFeatureBuilderProps) {
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!isOpen) setQuery('');
  }, [isOpen]);

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      item =>
        item.label.toLowerCase().includes(q) ||
        item.subtitle?.toLowerCase().includes(q) ||
        item.section.toLowerCase().includes(q) ||
        item.key.toLowerCase().includes(q),
    );
  }, [items, query]);

  const sections = useMemo(() => groupFeaturesBySection(filteredItems), [filteredItems]);


  return (
    <>
      <ViewCornerFabStack expanded={isOpen || cornerExpanded}>
        <button
          type="button"
          onClick={onToggleOpen}
          aria-label={isOpen ? 'Close feature builder' : 'Open feature builder'}
          aria-expanded={isOpen}
          data-tour-id="feature-builder-fab"
          className={cornerFabClass(isDarkMode, isOpen)}
        >
          <Icon icon="material-symbols:construction" className="h-6 w-6" />
        </button>
        {cornerExtras}
      </ViewCornerFabStack>

      {isOpen && (
        <FeatureBuilderPanel
          isDarkMode={isDarkMode}
          onClose={onClose}
          title={title}
          subtitle={subtitle}
          toolbar={
            <label className="relative block">
              <Search
                className={`pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 ${
                  isDarkMode ? 'text-gray-500' : 'text-gray-400'
                }`}
              />
              <input
                type="search"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search features…"
                className={`w-full rounded-xl border py-2 pl-8 pr-3 text-[12.5px] outline-none transition-colors ${
                  isDarkMode
                    ? 'border-gray-800 bg-gray-900/60 text-gray-100 placeholder:text-gray-600 focus:border-[#13C296]/40'
                    : 'border-gray-200 bg-gray-50 text-gray-800 placeholder:text-gray-400 focus:border-[#13C296]/40'
                }`}
              />
            </label>
          }
        >
          {sections.length === 0 ? (
            <p className={`text-center text-[12px] ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
              No features match “{query.trim()}”.
            </p>
          ) : (
            sections.map(({ section, items: sectionItems }) => (
              <section key={section} className="space-y-2">
                <SectionLabel isDarkMode={isDarkMode}>{section}</SectionLabel>
                <div className="space-y-2">
                  {sectionItems.map(item => (
                    <ToggleRow
                      key={item.key}
                      label={item.label}
                      subtitle={item.subtitle}
                      scope={item.scope}
                      isActive={Boolean(values[item.key])}
                      onClick={() => onToggle(item.key)}
                      isDarkMode={isDarkMode}
                      config={featureConfig?.[item.key]}
                    />
                  ))}
                </div>
              </section>
            ))
          )}
          {extras}
        </FeatureBuilderPanel>
      )}
    </>
  );
}
