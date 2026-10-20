import { ICON_VARIANT_TOKENS } from '../feedbackTokens';
import { getTooltipKind } from '../tooltipPresets';
import {
  tooltipBaseAnimation,
  tooltipBrandShell,
  tooltipCompactShell,
  tooltipDarkShell,
  tooltipKbdClass,
  tooltipLightShell,
  tooltipStatusShell,
} from '../tooltipTokens';
import type { TooltipItem } from '../types';

interface TooltipContentProps {
  tooltip: TooltipItem;
  isDarkMode: boolean;
}

function TooltipCaret({
  isDarkMode,
  inverted = false,
}: {
  isDarkMode: boolean;
  inverted?: boolean;
}) {
  const fill = inverted
    ? 'border-t-gray-900'
    : isDarkMode
      ? 'border-t-gray-800'
      : 'border-t-white';
  const border = inverted
    ? ''
    : isDarkMode
      ? 'drop-shadow-[0_1px_0_rgb(55,65,81)]'
      : 'drop-shadow-[0_1px_0_rgb(229,231,235)]';

  return (
    <span
      className={`absolute left-1/2 -translate-x-1/2 -bottom-1.5 w-0 h-0 border-x-[6px] border-x-transparent border-t-[6px] ${fill} ${border}`}
      aria-hidden="true"
    />
  );
}

function ShortcutBadges({
  shortcuts,
  isDarkMode,
  inverted = false,
}: {
  shortcuts: string[];
  isDarkMode: boolean;
  inverted?: boolean;
}) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {shortcuts.map(key => (
        <kbd key={key} className={tooltipKbdClass(isDarkMode, inverted)}>
          {key}
        </kbd>
      ))}
    </span>
  );
}

export function TooltipContent({ tooltip, isDarkMode }: TooltipContentProps) {
  const kind = getTooltipKind(tooltip.name);
  const anim = tooltipBaseAnimation();
  const body = isDarkMode ? 'text-gray-200' : 'text-gray-700';
  const muted = isDarkMode ? 'text-gray-500' : 'text-gray-400';
  const shortcuts = tooltip.shortcuts?.length
    ? tooltip.shortcuts
    : tooltip.shortcut
      ? [tooltip.shortcut]
      : [];

  if (kind === 'compact') {
    return (
      <div
        role="tooltip"
        className={`max-w-[220px] px-2.5 py-1 rounded-md border text-[11px] font-medium leading-snug ${anim} ${tooltipCompactShell()}`}
      >
        {tooltip.message}
      </div>
    );
  }

  if (kind === 'dark') {
    return (
      <div
        role="tooltip"
        className={`max-w-[260px] px-3 py-2 rounded-lg border text-[12px] leading-snug ${anim} ${tooltipDarkShell()}`}
      >
        {tooltip.message && <p>{tooltip.message}</p>}
        {(tooltip.tertiary ?? tooltip.description) && (
          <p className="mt-1 text-[11px] text-gray-400">{tooltip.tertiary ?? tooltip.description}</p>
        )}
      </div>
    );
  }

  if (kind === 'brand') {
    return (
      <div
        role="tooltip"
        className={`max-w-[280px] px-3 py-2 rounded-lg border text-[12px] leading-snug ${anim} ${tooltipBrandShell(isDarkMode)}`}
      >
        {tooltip.title && <p className="text-[12px] font-bold mb-0.5">{tooltip.title}</p>}
        {tooltip.message && <p>{tooltip.message}</p>}
      </div>
    );
  }

  if (kind === 'icon' || kind === 'status') {
    const variant = tooltip.variant ?? 'info';
    const tokens = ICON_VARIANT_TOKENS[variant];
    const Icon = tokens.icon;
    const shell =
      kind === 'status'
        ? tooltipStatusShell(variant, isDarkMode)
        : tooltipLightShell(isDarkMode);

    return (
      <div
        role="tooltip"
        className={`flex items-start gap-2.5 max-w-[280px] px-3 py-2 rounded-lg border text-[12px] leading-snug ${anim} ${shell}`}
      >
        <span className={`flex-shrink-0 w-6 h-6 rounded-lg flex items-center justify-center ${tokens.iconBg}`}>
          <Icon className={`w-3.5 h-3.5 ${tokens.iconColor}`} strokeWidth={2.5} />
        </span>
        <div className="min-w-0">
          {tooltip.title && (
            <p className={`text-[12px] font-bold mb-0.5 ${kind === 'status' ? '' : isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              {tooltip.title}
            </p>
          )}
          {tooltip.message && (
            <p className={kind === 'status' ? '' : body}>{tooltip.message}</p>
          )}
          {(tooltip.tertiary ?? tooltip.description) && (
            <p className={`mt-1 text-[11px] ${kind === 'status' ? 'opacity-80' : muted}`}>
              {tooltip.tertiary ?? tooltip.description}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (kind === 'shortcut') {
    return (
      <div
        role="tooltip"
        className={`flex items-center gap-2 max-w-[280px] px-3 py-2 rounded-lg border text-[12px] leading-snug ${anim} ${tooltipLightShell(isDarkMode)}`}
      >
        {tooltip.message && <span className={`flex-1 min-w-0 ${body}`}>{tooltip.message}</span>}
        {shortcuts.length > 0 && (
          <ShortcutBadges shortcuts={shortcuts} isDarkMode={isDarkMode} />
        )}
      </div>
    );
  }

  if (kind === 'multiShortcut') {
    return (
      <div
        role="tooltip"
        className={`max-w-[300px] px-3 py-2.5 rounded-lg border text-[12px] leading-snug ${anim} ${tooltipLightShell(isDarkMode)}`}
      >
        {tooltip.message && <p className={`mb-2 ${body}`}>{tooltip.message}</p>}
        {shortcuts.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <ShortcutBadges shortcuts={shortcuts} isDarkMode={isDarkMode} />
          </div>
        )}
      </div>
    );
  }

  if (kind === 'rich') {
    return (
      <div
        role="tooltip"
        className={`max-w-[280px] px-3 py-2.5 rounded-lg border text-[12px] leading-snug ${anim} ${tooltipLightShell(isDarkMode)}`}
      >
        {tooltip.title && (
          <p className={`text-[12px] font-bold mb-1 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            {tooltip.title}
          </p>
        )}
        {tooltip.message && <p className={body}>{tooltip.message}</p>}
        {(tooltip.tertiary ?? tooltip.description) && (
          <p className={`mt-1.5 text-[11px] ${muted}`}>{tooltip.tertiary ?? tooltip.description}</p>
        )}
      </div>
    );
  }

  if (kind === 'list') {
    const items = tooltip.items ?? [];
    return (
      <div
        role="tooltip"
        className={`max-w-[280px] px-3 py-2.5 rounded-lg border text-[12px] leading-snug ${anim} ${tooltipLightShell(isDarkMode)}`}
      >
        {tooltip.title && (
          <p className={`text-[12px] font-bold mb-1.5 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            {tooltip.title}
          </p>
        )}
        <ul className={`space-y-1 list-disc pl-4 ${body}`}>
          {items.map(item => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    );
  }

  if (kind === 'caret') {
    return (
      <div className="relative pb-1.5">
        <div
          role="tooltip"
          className={`relative max-w-[260px] px-3 py-2 rounded-lg border text-[12px] leading-snug ${anim} ${tooltipLightShell(isDarkMode)}`}
        >
          {tooltip.message && <p className={body}>{tooltip.message}</p>}
          {(tooltip.tertiary ?? tooltip.description) && (
            <p className={`mt-1 text-[11px] ${muted}`}>{tooltip.tertiary ?? tooltip.description}</p>
          )}
          <TooltipCaret isDarkMode={isDarkMode} />
        </div>
      </div>
    );
  }

  return (
    <div
      role="tooltip"
      className={`max-w-[260px] px-3 py-2 rounded-lg border text-[12px] leading-snug ${anim} ${tooltipLightShell(isDarkMode)}`}
    >
      {tooltip.message && <p className={body}>{tooltip.message}</p>}
      {(tooltip.tertiary ?? tooltip.description) && (
        <p className={`mt-1 text-[11px] ${muted}`}>{tooltip.tertiary ?? tooltip.description}</p>
      )}
    </div>
  );
}
