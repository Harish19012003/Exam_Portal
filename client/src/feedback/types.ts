import type { FeedbackComponentName } from './registry';
import type { AlertPositionSettings } from './alertPosition';
import type { ConfirmPositionSettings } from './confirmPosition';
import type { FlashPositionSettings } from './flashPosition';
import type { InputPositionSettings } from './inputPosition';
import type { LoadingPositionSettings } from './loadingPosition';
import type { NotificationPositionSettings } from './notificationPosition';
import type { PopupPositionSettings } from './popupPosition';
import type { ToastPositionSettings } from './toastPosition';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface FeedbackAction {
  label: string;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'destructive';
}

export interface ToastShowOptions {
  title?: string;
  message?: string;
  /** Optional third line below message (smaller, muted) */
  tertiary?: string;
  /** @deprecated Use `tertiary` instead */
  description?: string;
  /** ms — null = sticky until dismissed */
  duration?: number | null;
  actions?: FeedbackAction[];
  onUndo?: () => void;
  undoDuration?: number;
  /** Called when toast is dismissed (close button or programmatic dismiss) */
  onDismiss?: () => void;
}

export interface AlertShowOptions {
  title?: string;
  message?: string;
  tertiary?: string;
  /** @deprecated Use `tertiary` instead */
  description?: string;
  okLabel?: string;
  onOk?: () => void;
}

export interface ConfirmShowOptions {
  title?: string;
  message?: string;
  tertiary?: string;
  /** @deprecated Use `tertiary` instead */
  description?: string;
  cancelLabel?: string;
  confirmLabel?: string;
  confirmVariant?: 'primary' | 'destructive';
  onCancel?: () => void;
  onConfirm?: () => void;
  actions?: FeedbackAction[];
}

export type InputFieldType = 'text' | 'email' | 'number' | 'select' | 'checkbox' | 'textarea';

export interface InputFieldOption {
  label: string;
  value: string;
}

export interface InputFieldSchema {
  key: string;
  label: string;
  type: InputFieldType;
  placeholder?: string;
  required?: boolean;
  options?: InputFieldOption[];
  defaultValue?: string | boolean;
}

export interface InputShowOptions {
  title?: string;
  message?: string;
  tertiary?: string;
  /** @deprecated Use `tertiary` instead */
  description?: string;
  fields?: InputFieldSchema[];
  submitLabel?: string;
  cancelLabel?: string;
  validateOnSubmit?: boolean;
  onSubmit?: (values: Record<string, string | boolean>) => void;
  onCancel?: () => void;
  validate?: (values: Record<string, string | boolean>) => Record<string, string> | null;
}

export interface FlashShowOptions {
  title?: string;
  message?: string;
  tertiary?: string;
  /** @deprecated Use `tertiary` instead */
  description?: string;
  /** ms — null = sticky until dismissed */
  duration?: number | null;
  dismissible?: boolean;
  action?: FeedbackAction;
}

export interface NotificationEntry {
  title: string;
  message?: string;
  tertiary?: string;
  timestamp?: string;
  unread?: boolean;
}

export interface NotificationShowOptions {
  title?: string;
  message?: string;
  tertiary?: string;
  /** @deprecated Use `tertiary` instead */
  description?: string;
  timestamp?: string;
  unread?: boolean;
  actions?: FeedbackAction[];
  items?: NotificationEntry[];
  duration?: number | null;
}

export interface PopupMenuItem {
  label: string;
  onClick?: () => void;
  variant?: 'default' | 'destructive';
}

export interface PopupShowOptions {
  title?: string;
  message?: string;
  tertiary?: string;
  /** @deprecated Use `tertiary` instead */
  description?: string;
  menuItems?: PopupMenuItem[];
  actions?: FeedbackAction[];
}

export interface TooltipShowOptions {
  title?: string;
  message?: string;
  tertiary?: string;
  /** @deprecated Use `tertiary` instead */
  description?: string;
  /** Keyboard shortcut label, e.g. "⌘ K" */
  shortcut?: string;
  /** Multiple keyboard shortcuts */
  shortcuts?: string[];
  /** Bullet list items for list-style tooltips */
  items?: string[];
  /** Viewport coordinates — tooltip appears beside the cursor */
  anchorX?: number;
  anchorY?: number;
}

export interface LoadingShowOptions {
  title?: string;
  message?: string;
  tertiary?: string;
  /** @deprecated Use `tertiary` instead */
  description?: string;
  /** 0–100 for progress bar / circle */
  progress?: number;
  indeterminate?: boolean;
  /** Animate progress from 0 to target in demo */
  animateProgress?: boolean;
  /** Full-screen overlay (page loader) */
  overlay?: boolean;
  duration?: number | null;
}

export interface ToastItem extends ToastShowOptions {
  id: string;
  name: FeedbackComponentName;
  variant: ToastVariant;
  createdAt: number;
}

export interface AlertItem extends AlertShowOptions {
  id: string;
  name: FeedbackComponentName;
  variant: ToastVariant;
  createdAt: number;
}

export interface ConfirmItem extends ConfirmShowOptions {
  id: string;
  name: FeedbackComponentName;
  variant: ToastVariant;
  createdAt: number;
}

export interface InputItem extends InputShowOptions {
  id: string;
  name: FeedbackComponentName;
  variant: ToastVariant;
  createdAt: number;
}

export interface FlashItem extends FlashShowOptions {
  id: string;
  name: FeedbackComponentName;
  variant: ToastVariant;
  createdAt: number;
}

export interface NotificationItem extends NotificationShowOptions {
  id: string;
  name: FeedbackComponentName;
  variant: ToastVariant;
  createdAt: number;
}

export interface PopupItem extends PopupShowOptions {
  id: string;
  name: FeedbackComponentName;
  variant: ToastVariant;
  createdAt: number;
}

export interface TooltipItem extends TooltipShowOptions {
  id: string;
  name: FeedbackComponentName;
  variant: ToastVariant;
  createdAt: number;
}

export interface LoadingItem extends LoadingShowOptions {
  id: string;
  name: FeedbackComponentName;
  variant: ToastVariant;
  createdAt: number;
}

export interface FeedbackContextValue {
  show: (
    name: FeedbackComponentName,
    options?:
      | ToastShowOptions
      | AlertShowOptions
      | ConfirmShowOptions
      | InputShowOptions
      | FlashShowOptions
      | NotificationShowOptions
      | PopupShowOptions
      | TooltipShowOptions
      | LoadingShowOptions,
  ) => string | undefined;
  dismiss: (id: string) => void;
  dismissConfirm: () => void;
  dismissTooltip: () => void;
  toastPosition: ToastPositionSettings;
  setToastPosition: (settings: ToastPositionSettings) => void;
  alertPosition: AlertPositionSettings;
  setAlertPosition: (settings: AlertPositionSettings) => void;
  confirmPosition: ConfirmPositionSettings;
  setConfirmPosition: (settings: ConfirmPositionSettings) => void;
  inputPosition: InputPositionSettings;
  setInputPosition: (settings: InputPositionSettings) => void;
  flashPosition: FlashPositionSettings;
  setFlashPosition: (settings: FlashPositionSettings) => void;
  notificationPosition: NotificationPositionSettings;
  setNotificationPosition: (settings: NotificationPositionSettings) => void;
  popupPosition: PopupPositionSettings;
  setPopupPosition: (settings: PopupPositionSettings) => void;
  loadingPosition: LoadingPositionSettings;
  setLoadingPosition: (settings: LoadingPositionSettings) => void;
}
