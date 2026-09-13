'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

type ToastHandler = (message: string) => void;

let imperativeToast: ToastHandler | null = null;

/** 非 React 代码也可调用（apiClient / sync 工具） */
export function toast(message: string) {
  if (!message.trim()) return;
  if (imperativeToast) {
    imperativeToast(message);
    return;
  }
  if (typeof window !== 'undefined') {
    // Provider 尚未挂载时的兜底
    console.info('[toast]', message);
  }
}

const ToastContext = createContext<(message: string) => void>((msg) => toast(msg));

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);

  const show = useCallback((msg: string) => {
    if (!msg.trim()) return;
    setMessage(msg);
  }, []);

  useEffect(() => {
    imperativeToast = show;
    return () => {
      if (imperativeToast === show) imperativeToast = null;
    };
  }, [show]);

  useEffect(() => {
    if (!message) return;
    const t = window.setTimeout(() => setMessage(null), 2200);
    return () => window.clearTimeout(t);
  }, [message]);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {message ? (
        <div
          className="fixed bottom-20 left-1/2 z-[300] max-w-[min(92vw,24rem)] -translate-x-1/2 rounded-lg bg-[#3a2416] px-4 py-2.5 text-center text-sm text-white shadow-lg"
          role="status"
          aria-live="polite"
          style={{ animation: 'toastFadeInOut 2.2s ease-in-out' }}
        >
          {message}
        </div>
      ) : null}
    </ToastContext.Provider>
  );
}
