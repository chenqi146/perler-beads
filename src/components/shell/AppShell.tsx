'use client';

import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { AppNavBar } from './AppNavBar';
import { ToastProvider } from '../ui/ToastProvider';
import {
  NavSubtitleSetterContext,
  NavSubtitleStateContext,
  type NavSubtitleSlot,
} from './navSubtitleContext';

/** 全站布局容器：背景、最大宽度、工作台全屏高度；不承载页面业务按钮。 */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() || '/';
  const isFullscreenWorkbench =
    pathname === '/' || pathname.startsWith('/editor') || pathname.startsWith('/bead');
  const [slot, setSlotState] = useState<NavSubtitleSlot>({});

  const setSlot = useCallback((next: NavSubtitleSlot) => {
    setSlotState((prev) => (prev.subtitle === next.subtitle ? prev : next));
  }, []);

  useEffect(() => {
    if (!isFullscreenWorkbench) setSlotState({});
  }, [isFullscreenWorkbench]);

  return (
    <ToastProvider>
      <NavSubtitleSetterContext.Provider value={setSlot}>
        <NavSubtitleStateContext.Provider value={slot}>
          <div
            className={[
              'bg-[#f7f4ef] text-[#3a2416] font-[family-name:var(--font-geist-sans)]',
              isFullscreenWorkbench ? 'flex h-dvh max-h-dvh flex-col overflow-hidden' : 'min-h-dvh',
            ].join(' ')}
          >
            <div
              className={[
                'mx-auto flex w-full max-w-[1920px] flex-col px-3 py-2 sm:px-4 lg:px-5',
                isFullscreenWorkbench ? 'h-full min-h-0 flex-1' : 'py-3 sm:py-4',
              ].join(' ')}
            >
              <AppNavBar />
              <div className={isFullscreenWorkbench ? 'flex min-h-0 flex-1 flex-col overflow-hidden' : undefined}>
                {children}
              </div>
            </div>
          </div>
        </NavSubtitleStateContext.Provider>
      </NavSubtitleSetterContext.Provider>
    </ToastProvider>
  );
}
