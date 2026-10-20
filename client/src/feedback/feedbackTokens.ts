import {
  AlertTriangle,
  CheckCircle2,
  Info,
  type LucideIcon,
  XCircle,
} from 'lucide-react';
import type { FeedbackAction, ToastVariant } from './types';

export const BRAND = {
  primary: '#13C296',
  primaryHover: '#0f9f7a',
} as const;

/** Keyboard focus ring shared across feedback controls */
export const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#13C296]/45 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900';

export const MODAL_BACKDROP =
  'fixed inset-0 z-[10050] bg-black/45 backdrop-blur-[2px] animate-[fadeIn_0.15s_ease-out]';

export const OVERLAY_BACKDROP =
  'absolute inset-0 bg-black/40 backdrop-blur-[1px] animate-[fadeIn_0.15s_ease-out]';

export interface IconVariantTokens {
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  progress: string;
  notificationIconBg: string;
  notificationIconColor: string;
  notificationAccent: string;
}

export const ICON_VARIANT_TOKENS: Record<ToastVariant, IconVariantTokens> = {
  success: {
    icon: CheckCircle2,
    iconBg: 'bg-emerald-500/15',
    iconColor: 'text-emerald-500',
    progress: 'bg-emerald-500',
    notificationIconBg: 'bg-emerald-500/15',
    notificationIconColor: 'text-emerald-500',
    notificationAccent: 'bg-emerald-500',
  },
  error: {
    icon: XCircle,
    iconBg: 'bg-red-500/15',
    iconColor: 'text-red-500',
    progress: 'bg-red-500',
    notificationIconBg: 'bg-red-500/15',
    notificationIconColor: 'text-red-500',
    notificationAccent: 'bg-red-500',
  },
  warning: {
    icon: AlertTriangle,
    iconBg: 'bg-amber-500/15',
    iconColor: 'text-amber-500',
    progress: 'bg-amber-500',
    notificationIconBg: 'bg-amber-500/15',
    notificationIconColor: 'text-amber-500',
    notificationAccent: 'bg-amber-500',
  },
  info: {
    icon: Info,
    iconBg: 'bg-blue-500/15',
    iconColor: 'text-blue-500',
    progress: 'bg-blue-500',
    notificationIconBg: 'bg-blue-500/15',
    notificationIconColor: 'text-blue-500',
    notificationAccent: 'bg-blue-500',
  },
};

export interface FlashSurfaceTokens {
  bg: string;
  border: string;
  title: string;
  body: string;
  iconColor: string;
}

export interface FlashVariantTokens {
  icon: LucideIcon;
  accent: string;
  light: FlashSurfaceTokens;
  dark: FlashSurfaceTokens;
}

export const FLASH_VARIANT_TOKENS: Record<ToastVariant, FlashVariantTokens> = {
  success: {
    icon: CheckCircle2,
    accent: 'bg-emerald-500',
    light: {
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
      title: 'text-emerald-950',
      body: 'text-emerald-800',
      iconColor: 'text-emerald-600',
    },
    dark: {
      bg: 'bg-emerald-950/35',
      border: 'border-emerald-800/50',
      title: 'text-emerald-100',
      body: 'text-emerald-200/85',
      iconColor: 'text-emerald-400',
    },
  },
  error: {
    icon: XCircle,
    accent: 'bg-red-500',
    light: {
      bg: 'bg-red-50',
      border: 'border-red-200',
      title: 'text-red-950',
      body: 'text-red-800',
      iconColor: 'text-red-600',
    },
    dark: {
      bg: 'bg-red-950/35',
      border: 'border-red-800/50',
      title: 'text-red-100',
      body: 'text-red-200/85',
      iconColor: 'text-red-400',
    },
  },
  warning: {
    icon: AlertTriangle,
    accent: 'bg-amber-500',
    light: {
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      title: 'text-amber-950',
      body: 'text-amber-800',
      iconColor: 'text-amber-600',
    },
    dark: {
      bg: 'bg-amber-950/35',
      border: 'border-amber-800/50',
      title: 'text-amber-100',
      body: 'text-amber-200/85',
      iconColor: 'text-amber-400',
    },
  },
  info: {
    icon: Info,
    accent: 'bg-blue-500',
    light: {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      title: 'text-blue-950',
      body: 'text-blue-800',
      iconColor: 'text-blue-600',
    },
    dark: {
      bg: 'bg-blue-950/35',
      border: 'border-blue-800/50',
      title: 'text-blue-100',
      body: 'text-blue-200/85',
      iconColor: 'text-blue-400',
    },
  },
};

export function feedbackModalShell(isDarkMode: boolean, accent?: 'destructive' | 'warning'): string {
  const base = isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200';
  if (accent === 'destructive') {
    return `${base} ring-1 ring-red-500/25 border-red-500/30`;
  }
  if (accent === 'warning') {
    return `${base} ring-1 ring-amber-500/20 border-amber-500/25`;
  }
  return base;
}

export function feedbackToastShell(isDarkMode: boolean): string {
  return isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200';
}

export function feedbackLoadingShell(isDarkMode: boolean): string {
  return isDarkMode
    ? 'bg-gray-900/90 border-gray-700'
    : 'bg-gray-50/95 border-gray-200';
}

export function dismissButtonClass(isDarkMode: boolean): string {
  return `p-1.5 rounded-lg flex-shrink-0 transition-colors ${FOCUS_RING}
    ${isDarkMode ? 'text-gray-500 hover:text-gray-200 hover:bg-gray-700' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'}`;
}

export function primaryButtonClass(extra = ''): string {
  return `px-5 py-2.5 rounded-xl text-[13px] font-bold bg-[#13C296] hover:bg-[#0f9f7a] text-white transition-colors shadow-sm ${FOCUS_RING} ${extra}`;
}

export function secondaryButtonClass(isDarkMode: boolean, extra = ''): string {
  return `py-2.5 rounded-xl text-[13px] font-bold border transition-colors ${FOCUS_RING} ${extra}
    ${isDarkMode ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`;
}

export function destructiveButtonClass(extra = ''): string {
  return `py-2.5 rounded-xl text-[13px] font-bold bg-red-500 hover:bg-red-600 text-white transition-colors shadow-sm ${FOCUS_RING} ${extra}`;
}

export function actionButtonClass(action: FeedbackAction, isDarkMode: boolean): string {
  const base = `px-3 py-1.5 rounded-lg text-[12px] font-bold transition-colors ${FOCUS_RING}`;
  switch (action.variant) {
    case 'primary':
      return `${base} bg-[#13C296] hover:bg-[#0f9f7a] text-white`;
    case 'destructive':
      return `${base} bg-red-500 hover:bg-red-600 text-white`;
    default:
      return `${base} ${isDarkMode ? 'border border-gray-600 text-gray-300 hover:bg-gray-700' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}`;
  }
}

export function modalActionButtonClass(action: FeedbackAction, isDarkMode: boolean): string {
  const base = `px-4 py-2.5 rounded-xl text-[13px] font-bold transition-colors shadow-sm ${FOCUS_RING}`;
  switch (action.variant) {
    case 'primary':
      return `${base} bg-[#13C296] hover:bg-[#0f9f7a] text-white`;
    case 'destructive':
      return `${base} bg-red-500 hover:bg-red-600 text-white`;
    default:
      return `${base} ${isDarkMode ? 'border border-gray-600 text-gray-300 hover:bg-gray-700' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}`;
  }
}

export function getConfirmModalAccent(name: string, variant: ToastVariant): 'destructive' | 'warning' | undefined {
  if (name === 'confirm.delete') return 'destructive';
  if (name === 'confirm.discard' || variant === 'warning') return 'warning';
  return undefined;
}

export function getConfirmAccentBar(name: string, variant: ToastVariant): string | null {
  if (name === 'confirm.delete') return 'bg-red-500';
  if (name === 'confirm.discard') return 'bg-amber-500';
  if (variant === 'error') return 'bg-red-500';
  if (variant === 'warning') return 'bg-amber-500';
  return null;
}
