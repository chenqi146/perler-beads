'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="platform-page flex min-h-[50vh] flex-col items-center justify-center text-center">
      <p className="eyebrow">ERROR</p>
      <h1 className="mt-2 text-2xl font-semibold text-[#3a2416]">出了点问题</h1>
      <p className="mt-2 max-w-md text-sm text-[#8a6a4a]">
        {error.message || '页面加载失败，请稍后重试。'}
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <button type="button" className="primary-button" onClick={reset}>
          重试
        </button>
        <Link href="/dashboard" className="secondary-button">
          回我的图纸
        </Link>
      </div>
    </main>
  );
}
