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
        // 用内边距收缩可用宽度；面板用 w-full，避免 96vw+padding 撑出横向滚动（iPhone 会感觉被放大）
        paddingTop: placement === 'drawer' ? undefined : 'max(0.75rem, env(safe-area-inset-top))',
        paddingBottom: placement === 'drawer' ? undefined : 'max(0.75rem, env(safe-area-inset-bottom))',
        paddingLeft: placement === 'drawer' ? undefined : 'max(0.75rem, env(safe-area-inset-left))',
        paddingRight:
          placement === 'drawer'
            ? undefined
            : 'max(0.75rem, env(safe-area-inset-right))',
        boxSizing: 'border-box',
      }}
    >
      <button
        type="button"
        aria-label="关闭"
        tabIndex={closeOnBackdrop ? 0 : -1}
        className="absolute inset-0 bg-[#3a2416]/50 backdrop-blur-sm motion-safe:transition-opacity motion-reduce:transition-none"
        onClick={closeOnBackdrop ? onClose : undefined}
      />
      <div
        className={cn(
          'relative z-10 box-border flex max-w-full flex-col overflow-hidden bg-[#fffaf3] shadow-2xl overscroll-contain',
          'motion-safe:transition-transform motion-reduce:transition-none',
          placement === 'center' && 'max-h-[min(92dvh,920px)] w-full rounded-xl',
          placement === 'drawer' && 'h-full w-80 max-w-[90vw]',
          placement === 'sheet' && 'max-h-[80vh] w-full rounded-t-2xl border-t border-[#eadfce]',
          panelClassName,
        )}
      >
        {children}
      </div>
    </div>
  );
}
