'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

export type ToastActionOptions = {
  message: string;
  actionLabel?: string;
  onAction?: () => void | Promise<void>;
  /** 默认纯文案 2200ms；带 action 时默认 45000ms */
  durationMs?: number;
};

type ToastState = {
  message: string;
  actionLabel?: string;
  onAction?: () => void | Promise<void>;
  durationMs: number;
  id: number;
};

type ToastFn = {
  (message: string): void;
  withAction: (options: ToastActionOptions) => void;
};

let imperativeShow: ((options: ToastActionOptions) => void) | null = null;
let toastIdSeq = 0;

function normalizeOptions(messageOrOptions: string | ToastActionOptions): ToastActionOptions {
  if (typeof messageOrOptions === 'string') {
    return { message: messageOrOptions, durationMs: 2200 };
  }
  return messageOrOptions;
}

/** 非 React 代码也可调用（apiClient / sync 工具） */
export function toast(message: string) {
  if (!message.trim()) return;
  if (imperativeShow) {
    imperativeShow({ message, durationMs: 2200 });
    return;
  }
  if (typeof window !== 'undefined') {
    console.info('[toast]', message);
  }
}

export function toastWithAction(options: ToastActionOptions) {
  if (!options.message.trim()) return;
  if (imperativeShow) {
    imperativeShow(options);
    return;
  }
  if (typeof window !== 'undefined') {
    console.info('[toast]', options.message);
  }
}

const ToastContext = createContext<ToastFn>(((msg: string) => toast(msg)) as ToastFn);

export function useToast(): ToastFn {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<ToastState | null>(null);
  const actionBusy = useRef(false);

  const show = useCallback((raw: ToastActionOptions) => {
    const opts = normalizeOptions(raw);
    if (!opts.message.trim()) return;
    const hasAction = Boolean(opts.actionLabel && opts.onAction);
    setCurrent({
      message: opts.message,
      actionLabel: opts.actionLabel,
      onAction: opts.onAction,
      durationMs: opts.durationMs ?? (hasAction ? 45_000 : 2200),
      id: ++toastIdSeq,
    });
  }, []);

  const toastFn = useCallback(
    (message: string) => {
      show({ message, durationMs: 2200 });
    },
    [show],
  ) as ToastFn;

  toastFn.withAction = (options: ToastActionOptions) => show(options);

  useEffect(() => {
    imperativeShow = show;
    return () => {
      if (imperativeShow === show) imperativeShow = null;
    };
  }, [show]);

  useEffect(() => {
    if (!current) return;
    const t = window.setTimeout(() => setCurrent(null), current.durationMs);
    return () => window.clearTimeout(t);
  }, [current]);

  const handleAction = async () => {
    if (!current?.onAction || actionBusy.current) return;
    actionBusy.current = true;
    try {
      await current.onAction();
      setCurrent(null);
    } finally {
      actionBusy.current = false;
    }
  };

  return (
    <ToastContext.Provider value={toastFn}>
      {children}
      {current ? (
        <div
          className="fixed bottom-20 left-1/2 z-[300] flex max-w-[min(92vw,24rem)] -translate-x-1/2 items-center gap-3 rounded-lg bg-[#3a2416] px-4 py-2.5 text-sm text-white shadow-lg"
          role="status"
          aria-live="polite"
        >
          <span className="min-w-0 flex-1 text-left">{current.message}</span>
          {current.actionLabel && current.onAction ? (
            <button
              type="button"
              onClick={() => void handleAction()}
              className="shrink-0 rounded-md bg-[#c47a2c] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[#b56c22] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e8b86a]"
            >
              {current.actionLabel}
            </button>
          ) : null}
        </div>
      ) : null}
    </ToastContext.Provider>
  );
}
