import { useEffect } from 'react';
import { Sparkles, X } from 'lucide-react';
import { dismissButtonClass, FLASH_VARIANT_TOKENS, FOCUS_RING } from '../feedbackTokens';
import type { FlashItem } from '../types';

interface FlashBannerProps {
  flash: FlashItem;
  innerAlign: string;
  isDarkMode: boolean;
  onDismiss: (id: string) => void;
}

export function FlashBanner({ flash, innerAlign, isDarkMode, onDismiss }: FlashBannerProps) {
  const styles = FLASH_VARIANT_TOKENS[flash.variant];
  const Icon = flash.name === 'flash.update' ? Sparkles : styles.icon;
  const dismissible = flash.dismissible !== false;
  const surface = isDarkMode ? styles.dark : styles.light;

  useEffect(() => {
    if (flash.duration == null) return;
    const t = setTimeout(() => onDismiss(flash.id), flash.duration);
    return () => clearTimeout(t);
  }, [flash.id, flash.duration, onDismiss]);

  return (
    <div
      role="status"
      aria-live="polite"
      className={`w-full border-b shadow-sm animate-[slideDown_0.2s_ease-out] ${surface.bg} ${surface.border}`}
    >
      <div className={`h-0.5 ${styles.accent}`} />
      <div className={`max-w-[1600px] mx-auto px-4 sm:px-6 py-2.5 flex items-center gap-3 ${innerAlign}`}>
        <Icon className={`w-4 h-4 flex-shrink-0 ${surface.iconColor}`} strokeWidth={2.5} />

        <div className="flex-1 min-w-0 text-left">
          <p className={`text-[13px] leading-snug ${surface.body}`}>
            {flash.title && (
              <span className={`font-bold ${surface.title}`}>{flash.title}</span>
            )}
            {flash.title && flash.message && (
              <span className={isDarkMode ? 'text-white/30' : 'opacity-40'}> · </span>
            )}
            {flash.message && <span>{flash.message}</span>}
          </p>
          {(flash.tertiary ?? flash.description) && (
            <p className={`text-[11px] mt-0.5 leading-snug ${surface.body} opacity-80`}>
              {flash.tertiary ?? flash.description}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {flash.action && (
            <button
              type="button"
              onClick={() => {
                flash.action?.onClick?.();
                onDismiss(flash.id);
              }}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold bg-[#13C296] hover:bg-[#0f9f7a] text-white transition-colors whitespace-nowrap ${FOCUS_RING}`}
            >
              {flash.action.label}
            </button>
          )}
          {dismissible && (
            <button
              type="button"
              onClick={() => onDismiss(flash.id)}
              className={`${dismissButtonClass(isDarkMode)} !p-1`}
              aria-label="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
