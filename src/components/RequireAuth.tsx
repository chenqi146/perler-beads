'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { applyAuthSuccess } from '@/utils/authClient';
import { clearLoggedInUser } from '@/utils/platformStore';
import { apiFetch } from '@/utils/apiClient';
import { useToast } from '@/components/ui/ToastProvider';

/** 客户端登录门禁：校验 /api/me；401/失败 → toast + 登录页 */
export default function RequireAuth({ children }: { children: ReactNode }) {
  const router = useRouter();
  const toast = useToast();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch('/api/me', undefined, {
          authRedirect: false,
          unauthorizedMessage: '请先登录',
        });
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
        if (res.status === 401) {
          toast('请先登录');
        } else if (res.status === 503) {
          toast('云端未就绪，请稍后重试或检查 D1 绑定');
        } else {
          toast('登录状态无效，请重新登录');
        }
      } catch {
        if (!cancelled) toast('网络异常，请重新登录');
      }

      clearLoggedInUser();
      if (!cancelled) {
        const next = typeof window !== 'undefined'
          ? `${window.location.pathname}${window.location.search}`
          : '/dashboard';
        router.replace(`/auth/login?next=${encodeURIComponent(next)}`);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router, toast]);

  if (!ready) return <main className="platform-page" />;
  return <>{children}</>;
}
