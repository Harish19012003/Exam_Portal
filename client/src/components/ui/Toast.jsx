import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import './Toast.css';

const ToastContext = createContext(null);

const ICONS = { success: CheckCircle2, error: AlertCircle, info: Info };
const MAX_VISIBLE = 3;

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const removeToast = useCallback((id) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  /**
   * type: 'success' | 'error' | 'info'. Errors stay a little longer by default.
   * The same message shown again stacks into one toast with a ×N count, and the timer restarts.
   */
  const addToast = useCallback(
    (message, type = 'info', duration) => {
      const id = `${type}:${message}`;
      clearTimeout(timers.current.get(id));
      timers.current.set(id, setTimeout(() => removeToast(id), duration ?? (type === 'error' ? 6000 : 3500)));
      setToasts((prev) => {
        const existing = prev.find((toast) => toast.id === id);
        if (existing) {
          return prev.map((toast) => (toast.id === id ? { ...toast, count: toast.count + 1 } : toast));
        }
        return [...prev, { id, message, type, count: 1 }];
      });
    },
    [removeToast]
  );

  const visible = toasts.slice(-MAX_VISIBLE);
  const hidden = toasts.length - visible.length;

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}

      <div className="app-toast-stack" aria-live="polite">
        {visible.map((toast) => {
          const Icon = ICONS[toast.type] || Info;
          return (
            <div
              key={toast.id}
              className={`app-toast app-toast--${toast.type}`}
              role={toast.type === 'error' ? 'alert' : 'status'}
            >
              <Icon size={18} className="app-toast-icon" />
              <span className="app-toast-message">{toast.message}</span>
              {toast.count > 1 ? <span className="app-toast-count">×{toast.count}</span> : null}
              <button
                type="button"
                className="app-toast-close"
                onClick={() => removeToast(toast.id)}
                aria-label="Dismiss notification"
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
        {hidden > 0 ? <div className="app-toast-more">+{hidden} more</div> : null}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
};
