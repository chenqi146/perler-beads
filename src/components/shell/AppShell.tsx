'use client';

import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppNavBar } from './AppNavBar';
import { ToastProvider } from '../ui/ToastProvider';
import { compactPlatformStoreIfNeeded } from '@/utils/platformStore';
import { ensureAnonymousSession } from '@/utils/authClient';
import {
  ImmersiveChromeContext,
  type ImmersiveChromeApi,
} from './immersiveChromeContext';
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
  const [immersive, setImmersiveState] = useState(false);

  const setSlot = useCallback((next: NavSubtitleSlot) => {
    setSlotState((prev) => (prev.subtitle === next.subtitle ? prev : next));
  }, []);

  const setImmersive = useCallback((next: boolean) => {
    setImmersiveState(next);
  }, []);

  const immersiveApi = useMemo<ImmersiveChromeApi>(
    () => ({ immersive, setImmersive }),
    [immersive, setImmersive],
  );

  useEffect(() => {
    compactPlatformStoreIfNeeded();
    void ensureAnonymousSession().catch((err) => {
      console.warn('[AppShell] ensureAnonymousSession', err);
    });
  }, []);

  useEffect(() => {
    if (!isFullscreenWorkbench) setSlotState({});
  }, [isFullscreenWorkbench]);

  useEffect(() => {
    setImmersiveState(false);
  }, [pathname]);

  return (
    <ToastProvider>
      <ImmersiveChromeContext.Provider value={immersiveApi}>
        <NavSubtitleSetterContext.Provider value={setSlot}>
          <NavSubtitleStateContext.Provider value={slot}>
            <div
              className={[
                'bg-[#f7f4ef] text-[#3a2416] font-[family-name:var(--font-geist-sans)]',
                isFullscreenWorkbench || immersive
                  ? 'flex h-dvh max-h-dvh flex-col overflow-hidden'
                  : 'min-h-dvh',
              ].join(' ')}
            >
              <div
                className={[
                  'mx-auto flex w-full max-w-[1920px] flex-col',
                  immersive
                    ? 'h-full min-h-0 flex-1 px-0 py-0'
                    : [
                        'px-3 py-2 sm:px-4 lg:px-5',
                        isFullscreenWorkbench ? 'h-full min-h-0 flex-1' : 'py-3 sm:py-4',
                      ].join(' '),
                ].join(' ')}
              >
                {immersive ? null : <AppNavBar />}
                <div
                  className={
                    isFullscreenWorkbench || immersive
                      ? 'flex min-h-0 flex-1 flex-col overflow-hidden'
                      : undefined
                  }
                >
                  {children}
                </div>
              </div>
            </div>
          </NavSubtitleStateContext.Provider>
        </NavSubtitleSetterContext.Provider>
      </ImmersiveChromeContext.Provider>
    </ToastProvider>
  );
}
