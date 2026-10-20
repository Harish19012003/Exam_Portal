import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { isAlertName, resolveAlertShow } from './alertPresets';
import {
  loadAlertPositionSettings,
  saveAlertPositionSettings,
  type AlertPositionSettings,
} from './alertPosition';
import { isConfirmName, resolveConfirmShow } from './confirmPresets';
import {
  loadConfirmPositionSettings,
  saveConfirmPositionSettings,
  type ConfirmPositionSettings,
} from './confirmPosition';
import { isFlashName, resolveFlashShow } from './flashPresets';
import {
  loadFlashPositionSettings,
  saveFlashPositionSettings,
  type FlashPositionSettings,
} from './flashPosition';
import { isInputName, resolveInputShow } from './inputPresets';
import {
  loadInputPositionSettings,
  saveInputPositionSettings,
  type InputPositionSettings,
} from './inputPosition';
import { isLoadingName, resolveLoadingShow } from './loadingPresets';
import {
  loadLoadingPositionSettings,
  saveLoadingPositionSettings,
  type LoadingPositionSettings,
} from './loadingPosition';
import { isNotificationName, isNotificationStack, resolveNotificationShow } from './notificationPresets';
import {
  loadNotificationPositionSettings,
  saveNotificationPositionSettings,
  type NotificationPositionSettings,
} from './notificationPosition';
import { isPopupName, resolvePopupShow } from './popupPresets';
import {
  loadPopupPositionSettings,
  savePopupPositionSettings,
  type PopupPositionSettings,
} from './popupPosition';
import { isTooltipName, resolveTooltipShow } from './tooltipPresets';
import type { FeedbackComponentName } from './registry';
import { isToastName, resolveToastShow } from './toastPresets';
import {
  loadToastPositionSettings,
  saveToastPositionSettings,
  type ToastPositionSettings,
} from './toastPosition';
import type {
  AlertItem,
  AlertShowOptions,
  ConfirmItem,
  ConfirmShowOptions,
  FeedbackContextValue,
  FlashItem,
  FlashShowOptions,
  InputItem,
  InputShowOptions,
  LoadingItem,
  LoadingShowOptions,
  NotificationItem,
  NotificationShowOptions,
  PopupItem,
  PopupShowOptions,
  TooltipItem,
  TooltipShowOptions,
  ToastItem,
  ToastShowOptions,
} from './types';
import { AlertHost } from './components/AlertHost';
import { ConfirmHost } from './components/ConfirmHost';
import { FlashHost } from './components/FlashHost';
import { InputHost } from './components/InputHost';
import { LoadingHost } from './components/LoadingHost';
import { NotificationHost } from './components/NotificationHost';
import { PopupHost } from './components/PopupHost';
import { TooltipHost } from './components/TooltipHost';
import { ToastHost } from './components/ToastHost';

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

let toastCounter = 0;
let alertCounter = 0;
let confirmCounter = 0;
let inputCounter = 0;
let flashCounter = 0;
let notificationCounter = 0;
let popupCounter = 0;
let tooltipCounter = 0;
let loadingCounter = 0;

function nextToastId(): string {
  toastCounter += 1;
  return `toast_${Date.now()}_${toastCounter}`;
}

function nextAlertId(): string {
  alertCounter += 1;
  return `alert_${Date.now()}_${alertCounter}`;
}

function nextConfirmId(): string {
  confirmCounter += 1;
  return `confirm_${Date.now()}_${confirmCounter}`;
}

function nextInputId(): string {
  inputCounter += 1;
  return `input_${Date.now()}_${inputCounter}`;
}

function nextFlashId(): string {
  flashCounter += 1;
  return `flash_${Date.now()}_${flashCounter}`;
}

function nextNotificationId(): string {
  notificationCounter += 1;
  return `notification_${Date.now()}_${notificationCounter}`;
}

function nextPopupId(): string {
  popupCounter += 1;
  return `popup_${Date.now()}_${popupCounter}`;
}

function nextTooltipId(): string {
  tooltipCounter += 1;
  return `tooltip_${Date.now()}_${tooltipCounter}`;
}

function nextLoadingId(): string {
  loadingCounter += 1;
  return `loading_${Date.now()}_${loadingCounter}`;
}

interface FeedbackProviderProps {
  children: ReactNode;
  isDarkMode?: boolean;
}

export function FeedbackProvider({ children, isDarkMode = false }: FeedbackProviderProps) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [activeAlert, setActiveAlert] = useState<AlertItem | null>(null);
  const [activeConfirm, setActiveConfirm] = useState<ConfirmItem | null>(null);
  const [activeInput, setActiveInput] = useState<InputItem | null>(null);
  const [flashes, setFlashes] = useState<FlashItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [activePopup, setActivePopup] = useState<PopupItem | null>(null);
  const [activeTooltip, setActiveTooltip] = useState<TooltipItem | null>(null);
  const [activeLoading, setActiveLoading] = useState<LoadingItem | null>(null);
  const [toastPosition, setToastPositionState] = useState<ToastPositionSettings>(() =>
    loadToastPositionSettings(),
  );
  const [alertPosition, setAlertPositionState] = useState<AlertPositionSettings>(() =>
    loadAlertPositionSettings(),
  );
  const [confirmPosition, setConfirmPositionState] = useState<ConfirmPositionSettings>(() =>
    loadConfirmPositionSettings(),
  );
  const [inputPosition, setInputPositionState] = useState<InputPositionSettings>(() =>
    loadInputPositionSettings(),
  );
  const [flashPosition, setFlashPositionState] = useState<FlashPositionSettings>(() =>
    loadFlashPositionSettings(),
  );
  const [notificationPosition, setNotificationPositionState] = useState<NotificationPositionSettings>(() =>
    loadNotificationPositionSettings(),
  );
  const [popupPosition, setPopupPositionState] = useState<PopupPositionSettings>(() =>
    loadPopupPositionSettings(),
  );
  const [loadingPosition, setLoadingPositionState] = useState<LoadingPositionSettings>(() =>
    loadLoadingPositionSettings(),
  );

  const setToastPosition = useCallback((settings: ToastPositionSettings) => {
    setToastPositionState(settings);
    saveToastPositionSettings(settings);
  }, []);

  const setAlertPosition = useCallback((settings: AlertPositionSettings) => {
    setAlertPositionState(settings);
    saveAlertPositionSettings(settings);
  }, []);

  const setConfirmPosition = useCallback((settings: ConfirmPositionSettings) => {
    setConfirmPositionState(settings);
    saveConfirmPositionSettings(settings);
  }, []);

  const setInputPosition = useCallback((settings: InputPositionSettings) => {
    setInputPositionState(settings);
    saveInputPositionSettings(settings);
  }, []);

  const setFlashPosition = useCallback((settings: FlashPositionSettings) => {
    setFlashPositionState(settings);
    saveFlashPositionSettings(settings);
  }, []);

  const setNotificationPosition = useCallback((settings: NotificationPositionSettings) => {
    setNotificationPositionState(settings);
    saveNotificationPositionSettings(settings);
  }, []);

  const setPopupPosition = useCallback((settings: PopupPositionSettings) => {
    setPopupPositionState(settings);
    savePopupPositionSettings(settings);
  }, []);

  const setLoadingPosition = useCallback((settings: LoadingPositionSettings) => {
    setLoadingPositionState(settings);
    saveLoadingPositionSettings(settings);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts(prev => {
      const toast = prev.find(t => t.id === id);
      toast?.onDismiss?.();
      return prev.filter(t => t.id !== id);
    });
    setActiveAlert(prev => (prev?.id === id ? null : prev));
    setActiveConfirm(prev => (prev?.id === id ? null : prev));
    setActiveInput(prev => (prev?.id === id ? null : prev));
    setFlashes(prev => prev.filter(f => f.id !== id));
    setNotifications(prev => prev.filter(n => n.id !== id));
    setActivePopup(prev => (prev?.id === id ? null : prev));
    setActiveTooltip(prev => (prev?.id === id ? null : prev));
    setActiveLoading(prev => (prev?.id === id ? null : prev));
  }, []);

  const dismissAlert = useCallback(() => {
    setActiveAlert(null);
  }, []);

  const dismissConfirm = useCallback(() => {
    setActiveConfirm(null);
  }, []);

  const dismissInput = useCallback(() => {
    setActiveInput(null);
  }, []);

  const dismissPopup = useCallback(() => {
    setActivePopup(null);
  }, []);

  const dismissTooltip = useCallback(() => {
    setActiveTooltip(null);
  }, []);

  const dismissLoading = useCallback(() => {
    setActiveLoading(null);
  }, []);

  const show = useCallback((
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
  ) => {
    if (isToastName(name)) {
      const resolved = resolveToastShow(name, options as ToastShowOptions | undefined);
      const id = nextToastId();
      const item: ToastItem = {
        id,
        name,
        variant: resolved.variant,
        title: resolved.title,
        message: resolved.message,
        tertiary: resolved.tertiary ?? resolved.description,
        duration: resolved.duration,
        actions: resolved.actions,
        onUndo: resolved.onUndo,
        undoDuration: resolved.undoDuration,
        onDismiss: resolved.onDismiss,
        createdAt: Date.now(),
      };
      setToasts(prev => [...prev, item]);
      return id;
    }

    if (isAlertName(name)) {
      const resolved = resolveAlertShow(name, options as AlertShowOptions | undefined);
      const item: AlertItem = {
        id: nextAlertId(),
        name,
        variant: resolved.variant,
        title: resolved.title,
        message: resolved.message,
        tertiary: resolved.tertiary ?? resolved.description,
        okLabel: resolved.okLabel,
        onOk: resolved.onOk,
        createdAt: Date.now(),
      };
      setActiveAlert(item);
      return;
    }

    if (isConfirmName(name)) {
      const resolved = resolveConfirmShow(name, options as ConfirmShowOptions | undefined);
      const id = nextConfirmId();
      const item: ConfirmItem = {
        id,
        name,
        variant: resolved.variant,
        title: resolved.title,
        message: resolved.message,
        tertiary: resolved.tertiary ?? resolved.description,
        cancelLabel: resolved.cancelLabel,
        confirmLabel: resolved.confirmLabel,
        confirmVariant: resolved.confirmVariant,
        onCancel: resolved.onCancel,
        onConfirm: resolved.onConfirm,
        actions: resolved.actions,
        createdAt: Date.now(),
      };
      setActiveConfirm(item);
      return id;
    }

    if (isInputName(name)) {
      const resolved = resolveInputShow(name, options as InputShowOptions | undefined);
      const item: InputItem = {
        id: nextInputId(),
        name,
        variant: resolved.variant,
        title: resolved.title,
        message: resolved.message,
        tertiary: resolved.tertiary ?? resolved.description,
        fields: resolved.fields,
        submitLabel: resolved.submitLabel,
        cancelLabel: resolved.cancelLabel,
        validateOnSubmit: resolved.validateOnSubmit,
        onSubmit: resolved.onSubmit,
        onCancel: resolved.onCancel,
        validate: resolved.validate,
        createdAt: Date.now(),
      };
      setActiveInput(item);
      return;
    }

    if (isFlashName(name)) {
      const resolved = resolveFlashShow(name, options as FlashShowOptions | undefined);
      const item: FlashItem = {
        id: nextFlashId(),
        name,
        variant: resolved.variant,
        title: resolved.title,
        message: resolved.message,
        tertiary: resolved.tertiary ?? resolved.description,
        duration: resolved.duration,
        dismissible: resolved.dismissible,
        action: resolved.action,
        createdAt: Date.now(),
      };
      setFlashes([item]);
      return;
    }

    if (isNotificationName(name)) {
      const resolved = resolveNotificationShow(name, options as NotificationShowOptions | undefined);
      const item: NotificationItem = {
        id: nextNotificationId(),
        name,
        variant: resolved.variant,
        title: resolved.title,
        message: resolved.message,
        tertiary: resolved.tertiary ?? resolved.description,
        timestamp: resolved.timestamp,
        unread: resolved.unread,
        actions: resolved.actions,
        items: resolved.items,
        duration: resolved.duration,
        createdAt: Date.now(),
      };
      if (isNotificationStack(name)) {
        setNotifications([item]);
      } else {
        setNotifications(prev => [...prev, item]);
      }
      return;
    }

    if (isPopupName(name)) {
      const resolved = resolvePopupShow(name, options as PopupShowOptions | undefined);
      const item: PopupItem = {
        id: nextPopupId(),
        name,
        variant: resolved.variant,
        title: resolved.title,
        message: resolved.message,
        tertiary: resolved.tertiary ?? resolved.description,
        menuItems: resolved.menuItems,
        actions: resolved.actions,
        createdAt: Date.now(),
      };
      setActivePopup(item);
      return;
    }

    if (isTooltipName(name)) {
      const resolved = resolveTooltipShow(name, options as TooltipShowOptions | undefined);
      const opts = options as TooltipShowOptions | undefined;
      setActiveTooltip(prev => {
        if (
          prev?.name === name &&
          opts?.anchorX != null &&
          opts?.anchorY != null
        ) {
          return {
            ...prev,
            anchorX: opts.anchorX,
            anchorY: opts.anchorY,
          };
        }

        return {
          id: nextTooltipId(),
          name,
          variant: resolved.variant,
          title: resolved.title,
          message: resolved.message,
          tertiary: resolved.tertiary ?? resolved.description,
          shortcut: resolved.shortcut,
          shortcuts: resolved.shortcuts,
          items: resolved.items,
          anchorX: opts?.anchorX,
          anchorY: opts?.anchorY,
          createdAt: Date.now(),
        };
      });
      return;
    }

    if (isLoadingName(name)) {
      const resolved = resolveLoadingShow(name, options as LoadingShowOptions | undefined);
      const item: LoadingItem = {
        id: nextLoadingId(),
        name,
        variant: resolved.variant,
        title: resolved.title,
        message: resolved.message,
        tertiary: resolved.tertiary ?? resolved.description,
        progress: resolved.progress,
        indeterminate: resolved.indeterminate,
        animateProgress: resolved.animateProgress,
        overlay: resolved.overlay,
        duration: resolved.duration,
        createdAt: Date.now(),
      };
      setActiveLoading(item);
      return;
    }

    const item: ToastItem = {
      id: nextToastId(),
      name,
      variant: 'info',
      title: 'Coming soon',
      message: `${name} will be available in a future update.`,
      duration: 3500,
      createdAt: Date.now(),
      ...(options as ToastShowOptions),
    };
    setToasts(prev => [...prev, item]);
    return item.id;
  }, []);

  const value = useMemo<FeedbackContextValue>(
    () => ({
      show,
      dismiss,
      dismissConfirm,
      dismissTooltip,
      toastPosition,
      setToastPosition,
      alertPosition,
      setAlertPosition,
      confirmPosition,
      setConfirmPosition,
      inputPosition,
      setInputPosition,
      flashPosition,
      setFlashPosition,
      notificationPosition,
      setNotificationPosition,
      popupPosition,
      setPopupPosition,
      loadingPosition,
      setLoadingPosition,
    }),
    [
      show,
      dismiss,
      dismissConfirm,
      dismissTooltip,
      toastPosition,
      setToastPosition,
      alertPosition,
      setAlertPosition,
      confirmPosition,
      setConfirmPosition,
      inputPosition,
      setInputPosition,
      flashPosition,
      setFlashPosition,
      notificationPosition,
      setNotificationPosition,
      popupPosition,
      setPopupPosition,
      loadingPosition,
      setLoadingPosition,
    ],
  );

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      <ToastHost
        toasts={toasts}
        isDarkMode={isDarkMode}
        toastPosition={toastPosition}
        onDismiss={dismiss}
      />
      <AlertHost
        alert={activeAlert}
        isDarkMode={isDarkMode}
        alertPosition={alertPosition}
        onDismiss={dismissAlert}
      />
      <ConfirmHost
        confirm={activeConfirm}
        isDarkMode={isDarkMode}
        confirmPosition={confirmPosition}
        onDismiss={dismissConfirm}
      />
      <InputHost
        input={activeInput}
        isDarkMode={isDarkMode}
        inputPosition={inputPosition}
        onDismiss={dismissInput}
      />
      <FlashHost
        flashes={flashes}
        isDarkMode={isDarkMode}
        flashPosition={flashPosition}
        onDismiss={dismiss}
      />
      <NotificationHost
        notifications={notifications}
        isDarkMode={isDarkMode}
        notificationPosition={notificationPosition}
        onDismiss={dismiss}
      />
      <PopupHost
        popup={activePopup}
        isDarkMode={isDarkMode}
        popupPosition={popupPosition}
        onDismiss={dismissPopup}
      />
      <TooltipHost tooltip={activeTooltip} isDarkMode={isDarkMode} />
      <LoadingHost
        loading={activeLoading}
        isDarkMode={isDarkMode}
        loadingPosition={loadingPosition}
        onDismiss={dismissLoading}
      />
    </FeedbackContext.Provider>
  );
}

export function useFeedback(): FeedbackContextValue {
  const ctx = useContext(FeedbackContext);
  if (!ctx) {
    throw new Error('useFeedback must be used within FeedbackProvider');
  }
  return ctx;
}
