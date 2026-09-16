'use client';

import { createContext, useContext, useEffect } from 'react';

export type ImmersiveChromeApi = {
  immersive: boolean;
  setImmersive: (next: boolean) => void;
};

export const ImmersiveChromeContext = createContext<ImmersiveChromeApi>({
  immersive: false,
  setImmersive: () => {},
});

/** 拼豆等现场模式：隐藏顶栏与壳层边距，把第一屏留给画布。 */
export function useImmersiveChrome(active: boolean) {
  const { setImmersive } = useContext(ImmersiveChromeContext);
  useEffect(() => {
    setImmersive(active);
    return () => setImmersive(false);
  }, [active, setImmersive]);
}
