import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Icon } from '@iconify/react';
import { Check, Search, Settings, SlidersHorizontal, X } from 'lucide-react';
import type { ViewFeatureItem } from './viewFeatures';
import { groupFeaturesBySection } from './viewFeatures';
import { ViewCornerFabStack, cornerFabClass } from './ViewCornerFabs';
import { InfoTip } from './RecordDesignSidebar';

function SectionLabel({ children, isDarkMode }: { children: ReactNode; isDarkMode: boolean }) {
  return (
    <div
      className={`mb-3 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}
    >
      <SlidersHorizontal className="h-3.5 w-3.5 text-[#13C296]" />
      <span>{children}</span>
    </div>
  );
}

function ScopeBadge({ scope, isDarkMode }: { scope: 'shared' | 'view'; isDarkMode: boolean }) {
  const shared = scope === 'shared';
  return (
    <span
      className={`flex-shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
        shared
          ? isDarkMode
            ? 'bg-[#13C296]/20 text-[#5eead4]'
            : 'bg-emerald-50 text-emerald-800 border border-emerald-200/80'
          : isDarkMode
            ? 'bg-gray-700 text-gray-200'
            : 'bg-slate-200 text-slate-700 border border-slate-300/80'
      }`}
      title={shared ? 'Applies on every view that supports it' : 'Only for this view'}
    >
      {shared ? 'Shared' : 'This view'}
    </span>
  );
}

function ToggleRow({
  label,
  subtitle,
  scope,
  isActive,
  onClick,
  isDarkMode,
  config,
}: {
  label: string;
  subtitle?: string;
  scope: 'shared' | 'view';
  isActive: boolean;
  onClick: () => void;
  isDarkMode: boolean;
  /** When set, config is hidden until the gear is clicked. */
  config?: ReactNode;
}) {
  const [showConfig, setShowConfig] = useState(false);

  useEffect(() => {
    if (!isActive) setShowConfig(false);
  }, [isActive]);

  return (
    <div
      className={`flex w-full flex-col gap-2 rounded-xl border px-3.5 py-2.5 transition-all ${
        isActive
          ? isDarkMode
            ? 'border-[#13C296]/50 bg-[#13C296]/15 text-white shadow-2xs'
            : 'border-[#13C296]/40 bg-[#13C296]/10 text-gray-900 shadow-2xs'
          : isDarkMode
            ? 'border-gray-800 bg-gray-800/40 text-gray-400 hover:border-gray-700 hover:text-gray-300'
            : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-900'
      }`}
    >
      <div className="flex w-full items-center justify-between gap-2">
        <button
          type="button"
          onClick={onClick}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <div
            className={`flex h-4.5 w-4.5 flex-shrink-0 items-center justify-center rounded-full transition-colors ${
              isActive ? 'bg-[#13C296] text-[#111c18]' : isDarkMode ? 'bg-gray-700' : 'bg-gray-200'
            }`}
          >
            {isActive && <Check className="h-3 w-3 stroke-[3]" />}
          </div>
          <span className="min-w-0 truncate text-[12.5px] font-medium leading-snug">{label}</span>
        </button>
        <ScopeBadge scope={scope} isDarkMode={isDarkMode} />
        {subtitle ? <InfoTip text={subtitle} isDarkMode={isDarkMode} /> : null}
        {isActive && config ? (
          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              setShowConfig(v => !v);
            }}
            className={`rounded-lg p-1 transition-colors ${
              showConfig
                ? 'bg-[#13C296]/20 text-[#13C296]'
                : isDarkMode
                  ? 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                  : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'
            }`}
            title={showConfig ? 'Hide options' : 'Configure options'}
            aria-label={showConfig ? 'Hide options' : 'Configure options'}
            aria-expanded={showConfig}
          >
            <Settings className="h-3.5 w-3.5" />
          </button>
        ) : null}
        <button
          type="button"
          onClick={onClick}
          className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
            isActive
              ? 'bg-[#13C296]/20 text-[#0f9f7a]'
              : isDarkMode
                ? 'bg-gray-700 text-gray-200'
                : 'bg-slate-200 text-slate-700 border border-slate-300/70'
          }`}
        >
          {isActive ? 'ON' : 'OFF'}
        </button>
      </div>

      {isActive && showConfig && config ? (
        <div className="border-t border-dashed border-gray-700/30 pt-2">{config}</div>
      ) : null}
    </div>
  );
}

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
  const [isAnimatingIn, setIsAnimatingIn] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setIsAnimatingIn(false);
      setQuery('');
      return;
    }
    const id = requestAnimationFrame(() => setIsAnimatingIn(true));
    return () => cancelAnimationFrame(id);
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

  const bgClass = isDarkMode ? 'bg-[#0B1E19] text-gray-100' : 'bg-white text-gray-900';
  const borderClass = isDarkMode ? 'border-gray-800' : 'border-gray-200';

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
        <>
          <div
            className={`fixed inset-0 z-40 bg-black/15 transition-opacity duration-250 ${
              isAnimatingIn ? 'opacity-100' : 'opacity-0'
            }`}
            onClick={onClose}
          />
          <div
            data-tour-id="feature-builder-panel"
            className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col shadow-2xl transition-transform duration-250 ease-out ${bgClass} ${
              isAnimatingIn ? 'translate-x-0' : 'translate-x-full'
            }`}
          >
            <div className={`flex items-center justify-between border-b px-5 py-4 ${borderClass}`}>
              <div>
                <h2 className="text-sm font-bold tracking-tight">{title}</h2>
                <p className="text-[11px] text-gray-400">{subtitle}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className={`rounded-lg p-1.5 transition-colors ${
                  isDarkMode
                    ? 'text-gray-400 hover:bg-gray-800 hover:text-white'
                    : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className={`border-b px-5 py-3 ${borderClass}`}>
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
            </div>

            <div className="flex-1 space-y-6 overflow-y-auto p-5 custom-scrollbar">
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
            </div>
          </div>
        </>
      )}
    </>
  );
}
