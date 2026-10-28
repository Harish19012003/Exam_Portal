import { useEffect, useState, type ElementType, type ReactNode } from 'react';
import { Check, Settings, SlidersHorizontal, X } from 'lucide-react';
import { InfoTip } from './RecordDesignSidebar';

export function SectionLabel({
  icon: SectionIcon = SlidersHorizontal,
  children,
  isDarkMode,
}: {
  icon?: ElementType;
  children: ReactNode;
  isDarkMode: boolean;
}) {
  return (
    <div
      className={`mb-3 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}
    >
      <SectionIcon className="h-3.5 w-3.5 text-[#13C296]" />
      <span>{children}</span>
    </div>
  );
}

export function ScopeBadge({ scope, isDarkMode }: { scope: 'shared' | 'view'; isDarkMode: boolean }) {
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

export function ToggleRow({
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
  /** Omit to hide the Shared / This view badge. */
  scope?: 'shared' | 'view';
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
        {scope ? <ScopeBadge scope={scope} isDarkMode={isDarkMode} /> : null}
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

export interface FeatureBuilderPanelProps {
  isDarkMode: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: ReactNode;
  /** Fixed strip between the header and the scrolling body (e.g. search). */
  toolbar?: ReactNode;
  /** Fixed strip under the body (e.g. Save). */
  footer?: ReactNode;
  children: ReactNode;
  tourId?: string;
}

/** Slide-in panel shell shared by every Feature Builder (table and non-table views). */
export function FeatureBuilderPanel({
  isDarkMode,
  onClose,
  title = 'Feature Builder',
  subtitle = 'Grouped by what you want to do. Shared = every supporting view.',
  toolbar,
  footer,
  children,
  tourId = 'feature-builder-panel',
}: FeatureBuilderPanelProps) {
  const [isAnimatingIn, setIsAnimatingIn] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setIsAnimatingIn(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const handleClose = () => {
    setIsAnimatingIn(false);
    setTimeout(onClose, 250);
  };

  const bgClass = isDarkMode ? 'bg-[#0B1E19] text-gray-100' : 'bg-white text-gray-900';
  const borderClass = isDarkMode ? 'border-gray-800' : 'border-gray-200';

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/15 transition-opacity duration-250 ${isAnimatingIn ? 'opacity-100' : 'opacity-0'}`}
        onClick={handleClose}
      />
      <div
        data-tour-id={tourId}
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
            onClick={handleClose}
            aria-label="Close"
            className={`rounded-lg p-1.5 transition-colors ${
              isDarkMode
                ? 'text-gray-400 hover:bg-gray-800 hover:text-white'
                : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
            }`}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {toolbar ? <div className={`border-b px-5 py-3 ${borderClass}`}>{toolbar}</div> : null}
        <div className="flex-1 space-y-6 overflow-y-auto p-5 custom-scrollbar">{children}</div>
        {footer ? <div className={`flex-shrink-0 border-t px-5 py-4 ${borderClass}`}>{footer}</div> : null}
      </div>
    </>
  );
}
