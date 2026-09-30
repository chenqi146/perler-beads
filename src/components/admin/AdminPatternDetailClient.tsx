'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import type { Pattern } from '@/types/platform';
import { useToast } from '@/components/ui/ToastProvider';
import { upsertLocalPattern } from '@/utils/platformStore';

type Props = {
  pattern: Pattern;
  ownerLabel: string;
};

/** 后台查看图纸：载入本机后直达画布（只读预览，保存不覆盖他人） */
export function AdminPatternDetailClient({ pattern, ownerLabel }: Props) {
  const router = useRouter();
  const toast = useToast();
  const started = useRef(false);
  const empty = pattern.data.gridDimensions.N <= 0;

  useEffect(() => {
    if (empty || started.current) return;
    started.current = true;
    try {
      upsertLocalPattern(pattern);
      toast('已在画布打开（编辑保存不会覆盖他人图纸）');
      router.replace(`/editor/${pattern.id}`);
    } catch {
      toast('打开失败');
      started.current = false;
    }
  }, [empty, pattern, router, toast]);

  if (empty) {
    return (
      <main className="admin-page">
        <header className="admin-page-header">
          <div>
            <p className="eyebrow">ADMIN · PATTERN</p>
            <h1>{pattern.name}</h1>
            <p className="mt-1 text-sm text-[#8a6a4a]">
              作者：{ownerLabel} · 该图纸还没有格子数据
            </p>
          </div>
          <Link href="/admin/patterns" className="secondary-button">
            返回图纸列表
          </Link>
        </header>
      </main>
    );
  }

  return (
    <main className="admin-page">
      <header className="admin-page-header">
        <div>
          <p className="eyebrow">ADMIN · PATTERN</p>
          <h1>{pattern.name}</h1>
          <p className="mt-1 text-sm text-[#8a6a4a]">正在打开画布…</p>
        </div>
        <Link href="/admin/patterns" className="secondary-button">
          返回图纸列表
        </Link>
      </header>
    </main>
  );
}
