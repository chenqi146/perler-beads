'use client';

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function useConfirm(): ConfirmFn {
  const confirm = useContext(ConfirmContext);
  if (!confirm) {
    throw new Error('useConfirm must be used within ConfirmProvider');
  }
  return confirm;
}

type Pending = ConfirmOptions & {
  resolve: (value: boolean) => void;
};

/** 全局确认框：替代 window.confirm，样式跟 shadcn AlertDialog 一致 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const resultRef = useRef<boolean | null>(null);
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((options) => {
    resultRef.current = null;
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
      setPending({ ...options, resolve });
    });
  }, []);

  const handleOpenChange = (open: boolean) => {
    if (open) return;
    const result = resultRef.current ?? false;
    resultRef.current = null;
    const resolve = resolveRef.current;
    resolveRef.current = null;
    setPending(null);
    resolve?.(result);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AlertDialog open={pending != null} onOpenChange={handleOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pending?.title}</AlertDialogTitle>
            {pending?.description ? (
              <AlertDialogDescription>{pending.description}</AlertDialogDescription>
            ) : null}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                resultRef.current = false;
              }}
            >
              {pending?.cancelLabel ?? '取消'}
            </AlertDialogCancel>
            <AlertDialogAction
              variant={pending?.destructive ? 'destructive' : 'default'}
              onClick={() => {
                resultRef.current = true;
              }}
            >
              {pending?.confirmLabel ?? '确定'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmContext.Provider>
  );
}
