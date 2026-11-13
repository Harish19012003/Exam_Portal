import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Info, Loader2 } from 'lucide-react';

interface TableChangesBarProps {
  isDarkMode: boolean;
  /** What changed in the personal layout, e.g. ['column widths', 'footer totals']. */
  summary: string[];
  /** Personal layout has unsaved changes. */
  layoutDirty: boolean;
  layoutSaving: boolean;
  layoutError: string | null;
  onSaveLayout: () => void;
  onDiscardLayout: () => void;
  /** Feature Builder has unpublished changes (these affect everyone, so they are published separately). */
  featuresDirty?: boolean;
  featuresSaving?: boolean;
  onPublishFeatures?: () => void;
}

/**
 * Bottom-centre bar shown while the table has unsaved changes.
 * Personal layout → Save / Discard (only affects you).
 * Feature Builder → "Publish for everyone" (a separate, deliberate action).
 */
export function TableChangesBar({
  isDarkMode,
  summary,
  layoutDirty,
  layoutSaving,
  layoutError,
  onSaveLayout,
  onDiscardLayout,
  featuresDirty = false,
  featuresSaving = false,
  onPublishFeatures,
}: TableChangesBarProps) {
  // "What changed" lives behind an info icon: hover, keyboard focus, or click (tap) shows it.
  const tipId = useId();
  const infoRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pinned, setPinned] = useState(false);

  useEffect(() => {
    if (!pinned) {
      return undefined;
    }
    const onPointerDown = (event: Event) => {
      if (infoRef.current && !infoRef.current.contains(event.target as Node)) {
        setPinned(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPinned(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [pinned]);

  const showFeatures = featuresDirty && Boolean(onPublishFeatures);
  if (!layoutDirty && !showFeatures) {
    return null;
  }

  const parts = [...summary];
  if (showFeatures) {
    parts.push('feature settings');
  }
  const busy = layoutSaving || featuresSaving;
  const tipOpen = hovered || focused || pinned;

  // Quiet text actions (not buttons): the bar is a notice, so the actions read as part of the sentence.
  const linkBase =
    'inline-flex items-center gap-1.5 min-h-[44px] sm:min-h-[32px] px-1.5 -mx-0.5 rounded-md text-[13px] underline-offset-4 decoration-1 hover:underline transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#13C296]';
  const mutedLink = `${linkBase} font-medium ${isDarkMode ? 'text-gray-400 hover:text-gray-100' : 'text-gray-500 hover:text-gray-900'}`;
  const accentLink = `${linkBase} font-bold ${isDarkMode ? 'text-[#13C296] hover:text-[#5fe3c3]' : 'text-[#0a8066] hover:text-[#076650]'}`;
  const dotClass = isDarkMode ? 'text-gray-600' : 'text-gray-300';

  const tipText = [
    parts.length ? `Changed: ${parts.join(', ')}.` : 'Changes are kept in this browser until you save.',
    layoutDirty ? 'Saving applies to you only.' : '',
    showFeatures ? 'Publishing applies to everyone.' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return createPortal(
    <div
      role="region"
      aria-label="Unsaved table changes"
      className="fixed inset-x-3 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-max sm:max-w-[92vw] bottom-[max(0.75rem,env(safe-area-inset-bottom))] sm:bottom-5 z-[70] animate-[slideUp_0.2s_ease-out]"
    >
      <div
        className={`flex flex-wrap sm:flex-nowrap items-center gap-x-3 gap-y-0.5 rounded-xl border px-4 py-1.5 shadow-lg
          ${isDarkMode ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'}`}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1 basis-[200px] sm:flex-none sm:basis-auto" aria-live="polite">
          <span className="h-2 w-2 flex-shrink-0 rounded-full bg-amber-500" aria-hidden="true" />
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <p className={`text-[13px] font-semibold leading-tight whitespace-nowrap ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                Unsaved table changes
              </p>
              <div
                ref={infoRef}
                className="relative"
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
              >
                <button
                  type="button"
                  aria-label="What changed"
                  aria-describedby={tipId}
                  aria-expanded={tipOpen}
                  onClick={() => setPinned((v) => !v)}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  className={`flex items-center justify-center w-7 h-7 -my-1 rounded-full transition-colors
                    ${isDarkMode ? 'text-gray-400 hover:text-gray-100 hover:bg-gray-800' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'}`}
                >
                  <Info className="w-4 h-4" aria-hidden="true" />
                </button>
                <div
                  id={tipId}
                  role="tooltip"
                  className={`absolute left-0 bottom-full mb-2 z-10 w-max max-w-[min(280px,80vw)] rounded-xl border px-3 py-2 text-[12px] font-medium leading-snug shadow-xl transition-opacity duration-150
                    ${tipOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}
                    ${isDarkMode ? 'bg-gray-800 border-gray-700 text-gray-200' : 'bg-gray-900 border-gray-900 text-white'}`}
                >
                  {tipText}
                </div>
              </div>
            </div>
            {layoutError && (
              <p className="text-[12px] font-medium leading-snug mt-0.5 text-red-600 dark:text-red-400" role="alert">
                {layoutError}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap sm:flex-nowrap items-center gap-x-2 w-full sm:w-auto flex-shrink-0">
          {layoutDirty && (
            <>
              <button type="button" className={mutedLink} onClick={onDiscardLayout} disabled={busy}>
                Discard
              </button>
              <span className={dotClass} aria-hidden="true">·</span>
              <button type="button" className={accentLink} onClick={onSaveLayout} disabled={busy}>
                {layoutSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />}
                {layoutSaving ? 'Saving…' : layoutError ? 'Try again' : 'Save changes'}
              </button>
            </>
          )}
          {showFeatures && (
            <>
              {layoutDirty && <span className={dotClass} aria-hidden="true">·</span>}
              <button
                type="button"
                className={layoutDirty ? mutedLink : accentLink}
                onClick={onPublishFeatures}
                disabled={busy}
                title="Feature Builder changes apply to every portal member"
              >
                {featuresSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />}
                {featuresSaving ? 'Publishing…' : 'Publish for everyone'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
