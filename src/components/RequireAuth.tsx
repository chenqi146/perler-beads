'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';

/** 客户端登录门禁：无 perler-user-id 时跳转登录页 */
export default function RequireAuth({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (localStorage.getItem('perler-user-id')) {
      setReady(true);
      return;
    }
    router.replace('/auth/login');
  }, [router]);

  if (!ready) return <main className="platform-page" />;
  return <>{children}</>;
}
