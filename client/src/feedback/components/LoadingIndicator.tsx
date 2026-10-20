import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { getLoadingKind } from '../loadingPresets';
import {
  feedbackLoadingShell,
  feedbackModalShell,
  FOCUS_RING,
} from '../feedbackTokens';
import type { LoadingItem } from '../types';

function SpinnerRing({ className }: { className?: string }) {
  return <Loader2 className={`w-8 h-8 animate-spin ${className ?? 'text-[#13C296]'}`} strokeWidth={2.5} />;
}

function ProgressCircle({ progress, isDarkMode }: { progress: number; isDarkMode: boolean }) {
  const r = 28;
  const c = 2 * Math.PI * r;
  const offset = c - (progress / 100) * c;
  return (
    <div className="relative w-[72px] h-[72px] flex-shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 64 64">
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          strokeWidth="5"
          className={isDarkMode ? 'stroke-gray-700' : 'stroke-gray-200'}
        />
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="stroke-[#13C296] transition-all duration-300"
        />
      </svg>
      <span
        className={`absolute inset-0 flex items-center justify-center text-[13px] font-bold
          ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
      >
        {Math.round(progress)}%
      </span>
    </div>
  );
}

function LoadingDots() {
  return (
    <div className="flex items-center gap-1.5 h-8">
      {[0, 1, 2].map(i => (
        <span
          key={i}
          className="w-2 h-2 rounded-full bg-[#13C296] animate-dot-pulse"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  );
}

function SkeletonBlock({ isDarkMode }: { isDarkMode: boolean }) {
  const base = isDarkMode ? 'bg-gray-700' : 'bg-gray-200';
  const shimmer = isDarkMode
    ? 'bg-gradient-to-r from-gray-700 via-gray-600 to-gray-700 animate-shimmer'
    : 'bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 animate-shimmer';
  return (
    <div className="space-y-2.5 w-full">
      <div className={`h-3 rounded-md w-3/4 ${shimmer}`} />
      <div className={`h-3 rounded-md w-full ${shimmer}`} />
      <div className={`h-3 rounded-md w-5/6 ${shimmer}`} />
      <div className={`h-16 rounded-lg w-full mt-3 ${base} opacity-60`} />
    </div>
  );
}

interface LoadingIndicatorProps {
  loading: LoadingItem;
  isDarkMode: boolean;
  onDismiss: () => void;
}

export function LoadingIndicator({ loading, isDarkMode, onDismiss }: LoadingIndicatorProps) {
  const kind = getLoadingKind(loading.name);
  const [progress, setProgress] = useState(loading.progress ?? 0);
  const isOverlay = kind === 'loader';
  const isCompact = kind === 'dots' || kind === 'spinner';

  useEffect(() => {
    if (loading.duration == null) return;
    const t = setTimeout(onDismiss, loading.duration);
    return () => clearTimeout(t);
  }, [loading.duration, onDismiss]);

  useEffect(() => {
    if (!loading.animateProgress || loading.progress == null) return;
    setProgress(0);
    const target = loading.progress;
    const interval = setInterval(() => {
      setProgress(p => {
        if (p >= target) {
          clearInterval(interval);
          return target;
        }
        return Math.min(target, p + 2);
      });
    }, 40);
    return () => clearInterval(interval);
  }, [loading.animateProgress, loading.progress, loading.id]);

  const shell = isOverlay ? feedbackModalShell(isDarkMode) : feedbackLoadingShell(isDarkMode);
  const muted = isDarkMode ? 'text-gray-400' : 'text-gray-500';

  return (
    <div
      className={`relative overflow-hidden animate-[fadeIn_0.2s_ease-out] ${shell}
        ${isOverlay ? 'rounded-2xl border shadow-2xl' : 'rounded-xl border shadow-sm'}
        ${isOverlay ? 'p-8 min-w-[240px] text-center' : isCompact ? 'px-4 py-3 min-w-[220px]' : 'p-4 min-w-[260px] max-w-[340px]'}`}
    >
      {!isOverlay && (
        <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#13C296]" aria-hidden="true" />
      )}
      {!isOverlay && (
        <div
          className={`mb-2 text-[10px] font-semibold uppercase tracking-wider ${muted}`}
        >
          Loading
        </div>
      )}

      <div className={`flex gap-3 ${isOverlay ? 'flex-col items-center' : 'items-start'}`}>
        {kind === 'spinner' && <SpinnerRing />}
        {kind === 'loader' && <SpinnerRing className="w-10 h-10" />}
        {kind === 'dots' && <LoadingDots />}
        {kind === 'progresscircle' && <ProgressCircle progress={progress} isDarkMode={isDarkMode} />}
        {kind === 'skeleton' && <SkeletonBlock isDarkMode={isDarkMode} />}

        {kind !== 'skeleton' && (
          <div className={`flex-1 min-w-0 ${isOverlay ? 'text-center' : ''}`}>
            {loading.title && (
              <p className={`text-[13px] font-bold ${isOverlay ? 'mt-4' : ''}`}>{loading.title}</p>
            )}
            {loading.message && (
              <p className={`text-[12px] mt-0.5 ${muted}`}>{loading.message}</p>
            )}
            {(loading.tertiary ?? loading.description) && (
              <p className={`text-[11px] mt-1 ${muted} opacity-80`}>
                {loading.tertiary ?? loading.description}
              </p>
            )}

            {(kind === 'progressbar' || kind === 'indeterminate') && (
              <div className="mt-3 space-y-1.5">
                {kind === 'progressbar' && (
                  <div className="flex justify-between text-[10px] font-medium">
                    <span className={muted}>Progress</span>
                    <span className={isDarkMode ? 'text-[#13C296]' : 'text-[#0f9f7a]'}>{Math.round(progress)}%</span>
                  </div>
                )}
                <div className={`h-2 rounded-full overflow-hidden ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                  {kind === 'indeterminate' ? (
                    <div className="h-full w-1/3 rounded-full bg-[#13C296] animate-indeterminate-bar" />
                  ) : (
                    <div
                      className="h-full rounded-full bg-[#13C296] transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {kind === 'skeleton' && (
          <div className="flex-1 min-w-0 pt-1">
            {loading.title && <p className="text-[13px] font-bold">{loading.title}</p>}
            {loading.message && <p className={`text-[12px] mt-0.5 ${muted}`}>{loading.message}</p>}
          </div>
        )}
      </div>

      {isOverlay && (
        <button
          type="button"
          onClick={onDismiss}
          className={`mt-4 text-[11px] font-medium underline-offset-2 hover:underline ${muted} ${FOCUS_RING}`}
        >
          Cancel
        </button>
      )}
    </div>
  );
}
