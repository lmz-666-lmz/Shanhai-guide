import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: number;
  type: ToastType;
  content: string;
  exiting: boolean;
}

interface ToastContextValue {
  success: (content: string) => void;
  error: (content: string) => void;
  info: (content: string) => void;
  warning: (content: string) => void;
  show: (content: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 1;
const DURATIONS: Record<ToastType, number> = {
  success: 1800,
  info: 2200,
  error: 3000,
  warning: 2500,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  const exitTimersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  const contentKeysRef = useRef<Map<string, number>>(new Map());
  const toastKeysByIdRef = useRef<Map<number, string>>(new Map());

  useEffect(() => () => {
    timersRef.current.forEach(timer => clearTimeout(timer));
    exitTimersRef.current.forEach(timer => clearTimeout(timer));
    timersRef.current.clear();
    exitTimersRef.current.clear();
    contentKeysRef.current.clear();
    toastKeysByIdRef.current.clear();
  }, []);

  const removeToast = useCallback((id: number) => {
    const dedupeKey = toastKeysByIdRef.current.get(id);
    if (dedupeKey) {
      contentKeysRef.current.delete(dedupeKey);
      toastKeysByIdRef.current.delete(id);
    }

    // Start exit animation
    setToasts(prev => prev.map(t => (t.id === id ? { ...t, exiting: true } : t)));

    // Clear any existing exit timer for this id
    const existingExit = exitTimersRef.current.get(id);
    if (existingExit) clearTimeout(existingExit);

    // Remove from DOM after animation
    const exitTimer = setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
      exitTimersRef.current.delete(id);
    }, 240);
    exitTimersRef.current.set(id, exitTimer);

    // Clear the auto-dismiss timer
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const addToast = useCallback(
    (type: ToastType, content: string) => {
      const duration = DURATIONS[type];

      // Deduplicate: if the same content+type is already showing, replace it
      const dedupeKey = `${type}:${content}`;
      const existingId = contentKeysRef.current.get(dedupeKey);
      if (existingId !== undefined) {
        // Reset the timer for the existing toast
        const existingTimer = timersRef.current.get(existingId);
        if (existingTimer) clearTimeout(existingTimer);

        const newTimer = setTimeout(() => {
          removeToast(existingId);
        }, duration);
        timersRef.current.set(existingId, newTimer);

        // Ensure it's not in exiting state
        setToasts(prev => prev.map(t => (t.id === existingId ? { ...t, exiting: false } : t)));
        return;
      }

      const id = nextId++;
      contentKeysRef.current.set(dedupeKey, id);
      toastKeysByIdRef.current.set(id, dedupeKey);

      setToasts(prev => [...prev, { id, type, content, exiting: false }]);

      const timer = setTimeout(() => {
        removeToast(id);
      }, duration);
      timersRef.current.set(id, timer);
    },
    [removeToast],
  );

  const show = useCallback(
    (content: string) => addToast('info', content),
    [addToast],
  );
  const success = useCallback(
    (content: string) => addToast('success', content),
    [addToast],
  );
  const error = useCallback(
    (content: string) => addToast('error', content),
    [addToast],
  );
  const info = useCallback(
    (content: string) => addToast('info', content),
    [addToast],
  );
  const warning = useCallback(
    (content: string) => addToast('warning', content),
    [addToast],
  );

  const toastLayer = (
    <div
        className="pointer-events-none fixed inset-x-0 top-0 z-[12000] flex flex-col items-center gap-2 px-4 pt-[calc(env(safe-area-inset-top)+20px)]"
        aria-live="polite"
        role="status"
      >
        {toasts.map(toast => (
          <ToastView key={toast.id} toast={toast} onDismiss={() => removeToast(toast.id)} />
        ))}
      </div>
  );

  return (
    <ToastContext.Provider value={{ success, error, info, warning, show }}>
      {children}
      {typeof document !== 'undefined' ? createPortal(toastLayer, document.body) : toastLayer}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

/* ---- Toast View ---- */

function ToastView({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  return (
    <div
      className={`pointer-events-auto flex items-center gap-3 rounded-2xl border bg-white/95 px-4 py-3 shadow-lg shadow-slate-200/60 backdrop-blur-md transition-all duration-200 select-none max-w-[320px] ${
        toast.exiting ? 'translate-y-[-8px] opacity-0' : 'translate-y-0 opacity-100'
      } motion-reduce:transition-none`}
      style={{ boxShadow: '0 8px 24px rgba(148,163,184,0.18), 0 2px 6px rgba(148,163,184,0.08)' }}
      role={toast.type === 'error' ? 'alert' : undefined}
      aria-live={toast.type === 'error' ? 'assertive' : undefined}
    >
      <ToastIcon type={toast.type} />
      <span className="text-[15px] font-semibold leading-snug text-slate-800 line-clamp-2 break-words">
        {toast.content}
      </span>
      <button
        className="ml-auto shrink-0 flex h-6 w-6 items-center justify-center rounded-full text-slate-300 hover:text-slate-500 hover:bg-slate-100 transition-colors -mr-1"
        onClick={onDismiss}
        aria-label="关闭提示"
      >
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}

/* ---- Icon ---- */

function ToastIcon({ type }: { type: ToastType }) {
  switch (type) {
    case 'success':
      return (
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100">
          <svg
            className="h-5 w-5 text-emerald-600"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
      );
    case 'error':
      return (
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-100">
          <svg
            className="h-5 w-5 text-red-600"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </div>
      );
    case 'warning':
      return (
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100">
          <svg
            className="h-5 w-5 text-amber-600"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>
      );
    case 'info':
    default:
      return (
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100">
          <svg
            className="h-5 w-5 text-blue-600"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
        </div>
      );
  }
}
