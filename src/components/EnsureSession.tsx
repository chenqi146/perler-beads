'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { ensureAnonymousSession } from '@/utils/authClient';

/**
 * 无感身份门禁：自动确保本机游客/正式会话，不再跳转登录页。
 * 创作页使用；跨设备绑定仍由登录/注册入口完成。
 */
export default function EnsureSession({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await ensureAnonymousSession();
      } catch (err) {
        console.warn('[EnsureSession]', err);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) return <main className="platform-page" />;
  return <>{children}</>;
}
