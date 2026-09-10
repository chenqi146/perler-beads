'use client';

import { useEffect, type ReactNode } from 'react';
import { cn } from './cn';

export type OverlayPlacement = 'center' | 'drawer' | 'sheet';

type OverlayProps = {
  onClose: () => void;
  closeOnBackdrop?: boolean;
  labelledBy: string;
  placement?: OverlayPlacement;
  layer?: 'content' | 'import';
  panelClassName?: string;
  children: ReactNode;
};

const layerZ = {
  content: 260,
  import: 300,
} as const;

export function Overlay({
  onClose,
  closeOnBackdrop = true,
  labelledBy,
  placement = 'center',
  layer = 'content',
  panelClassName,
  children,
}: OverlayProps) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onClose();
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      className={cn(
        'fixed inset-0 flex',
        placement === 'center' && 'items-center justify-center',
        placement === 'drawer' && 'items-stretch justify-end',
        placement === 'sheet' && 'items-end justify-center',
      )}
      style={{
        zIndex: layerZ[layer],
        paddingTop: placement === 'drawer' ? undefined : 'max(0.75rem, env(safe-area-inset-top))',
        paddingBottom: placement === 'drawer' ? undefined : 'max(0.75rem, env(safe-area-inset-bottom))',
        paddingLeft: placement === 'drawer' ? undefined : 'max(0.75rem, env(safe-area-inset-left))',
        paddingRight: 'max(0.75rem, env(safe-area-inset-right))',
      }}
    >
      <button
        type="button"
        aria-label="关闭"
        tabIndex={closeOnBackdrop ? 0 : -1}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm motion-safe:transition-opacity motion-reduce:transition-none"
        onClick={closeOnBackdrop ? onClose : undefined}
      />
      <div
        className={cn(
          'relative z-10 flex flex-col overflow-hidden bg-white shadow-2xl overscroll-contain dark:bg-gray-800',
          'motion-safe:transition-transform motion-reduce:transition-none',
          placement === 'center' && 'max-h-[90vh] w-full rounded-xl',
          placement === 'drawer' && 'h-full w-80 max-w-[90vw]',
          placement === 'sheet' && 'max-h-[80vh] w-full rounded-t-2xl',
          panelClassName,
        )}
      >
        {children}
      </div>
    </div>
  );
}
