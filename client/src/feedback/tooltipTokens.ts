import type { ToastVariant } from './types';

export type TooltipDesignKind =
  | 'default'
  | 'info'
  | 'shortcut'
  | 'rich'
  | 'compact'
  | 'dark'
  | 'brand'
  | 'icon'
  | 'status'
  | 'multiShortcut'
  | 'list'
  | 'caret';

export function tooltipBaseAnimation(): string {
  return 'animate-[slideUp_0.15s_ease-out] shadow-lg';
}

export function tooltipLightShell(isDarkMode: boolean): string {
  return isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200';
}

export function tooltipCompactShell(): string {
  return 'bg-gray-900 text-white border-transparent shadow-xl';
}

export function tooltipDarkShell(): string {
  return 'bg-gray-950 text-gray-100 border-gray-800 shadow-2xl';
}

export function tooltipBrandShell(isDarkMode: boolean): string {
  return isDarkMode
    ? 'bg-[#13C296]/10 border-[#13C296]/35 text-[#13C296]'
    : 'bg-[#13C296]/8 border-[#13C296]/30 text-[#0f9f7a]';
}

export function tooltipStatusShell(variant: ToastVariant, isDarkMode: boolean): string {
  const map: Record<ToastVariant, string> = {
    success: isDarkMode
      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
      : 'bg-emerald-50 border-emerald-200 text-emerald-800',
    warning: isDarkMode
      ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
      : 'bg-amber-50 border-amber-200 text-amber-900',
    error: isDarkMode
      ? 'bg-red-500/10 border-red-500/30 text-red-300'
      : 'bg-red-50 border-red-200 text-red-800',
    info: isDarkMode
      ? 'bg-blue-500/10 border-blue-500/30 text-blue-200'
      : 'bg-blue-50 border-blue-200 text-blue-900',
  };
  return map[variant];
}

export function tooltipKbdClass(isDarkMode: boolean, inverted = false): string {
  if (inverted) {
    return 'font-mono text-[10px] px-1.5 py-0.5 rounded border border-white/20 bg-white/10 text-white/90';
  }
  return `font-mono text-[10px] px-1.5 py-0.5 rounded border
    ${isDarkMode ? 'border-gray-600 bg-gray-800 text-gray-300' : 'border-gray-200 bg-white text-gray-600'}`;
}
