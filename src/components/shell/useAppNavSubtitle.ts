'use client';

import { useContext, useEffect } from 'react';
import { NavSubtitleSetterContext } from './navSubtitleContext';

/** 页面仅可向顶栏注入副标题；操作按钮必须留在页面内。 */
export function useAppNavSubtitle(subtitle?: string) {
  const setSlot = useContext(NavSubtitleSetterContext);

  useEffect(() => {
    setSlot({ subtitle });
    return () => setSlot({});
  }, [setSlot, subtitle]);
}

/**
 * @deprecated 使用 useAppNavSubtitle(subtitle)。`actions` 已忽略，请把按钮放在页面内。
 */
export function useAppNavSlot(slot: { subtitle?: string; actions?: unknown }) {
  useAppNavSubtitle(slot.subtitle);
}
