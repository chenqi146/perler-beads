'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { applyAuthSuccess } from '@/utils/authClient';
import { clearLoggedInUser } from '@/utils/platformStore';

/** 客户端登录门禁：校验 /api/me（session cookie）；失败跳转登录 */
export default function RequireAuth({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/me', { credentials: 'include' });
        if (cancelled) return;
        if (res.ok) {
          const data = await res.json();
          if (data?.id) {
            const email = String(data.email || localStorage.getItem('perler-user-email') || '');
            const name = String(
              data.name || localStorage.getItem('perler-user-name') || '拼豆玩家',
            );
            localStorage.setItem('perler-user-id', String(data.id));
            if (name) localStorage.setItem('perler-user-name', name);
            if (email) {
              applyAuthSuccess({ id: String(data.id), name, email });
            }
            setReady(true);
            return;
          }
        }
      } catch {
        // fall through
      }

      if (process.env.NODE_ENV === 'development' && localStorage.getItem('perler-user-id')) {
        setReady(true);
        return;
      }

      clearLoggedInUser();
      router.replace('/auth/login');
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!ready) return <main className="platform-page" />;
  return <>{children}</>;
}
