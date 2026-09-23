'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Pattern } from '@/types/platform';
import { PatternPreviewImage } from '@/components/patterns/PatternPreviewImage';
import { useToast } from '@/components/ui/ToastProvider';
import { upsertLocalPattern } from '@/utils/platformStore';

type Props = {
  pattern: Pattern;
  ownerLabel: string;
};

export function AdminPatternDetailClient({ pattern, ownerLabel }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [opening, setOpening] = useState(false);

  const openInEditor = () => {
    setOpening(true);
    try {
      upsertLocalPattern(pattern);
      toast('已加载到本机预览（编辑保存不会覆盖他人图纸）');
      router.push(`/editor/${pattern.id}`);
    } catch {
      toast('加载失败');
      setOpening(false);
    }
  };

  const openInBead = () => {
    setOpening(true);
    try {
      upsertLocalPattern(pattern);
      router.push(`/bead/${pattern.id}`);
    } catch {
      toast('加载失败');
      setOpening(false);
    }
  };

  return (
    <main className="platform-page">
      <header className="platform-header">
        <div>
          <p className="eyebrow">ADMIN · PATTERN</p>
          <h1>{pattern.name}</h1>
          <p className="mt-1 text-sm text-[#8a6a4a]">
            作者：{ownerLabel} · {pattern.visibility === 'public' ? '公开' : '私有'} ·{' '}
            {pattern.data.gridDimensions.N} × {pattern.data.gridDimensions.M}
          </p>
        </div>
        <Link href={`/admin/users/${pattern.ownerId}`} className="secondary-button">
          返回该用户
        </Link>
      </header>

      {pattern.description ? (
        <p className="mb-4 text-sm text-[#8a6a4a]">{pattern.description}</p>
      ) : null}

      <div className="mx-auto max-w-lg overflow-hidden rounded-2xl border border-[#eadfce] bg-[#fffaf3]">
        <div className="aspect-square bg-[#f3e6d4]">
          <PatternPreviewImage
            data={pattern.data}
            cacheKey={`${pattern.id}:${pattern.updatedAt}`}
          />
        </div>
        <div className="flex flex-wrap gap-3 p-4">
          <button
            type="button"
            className="primary-button"
            disabled={opening || pattern.data.gridDimensions.N <= 0}
            onClick={openInEditor}
          >
            在编辑器中打开
          </button>
          <button
            type="button"
            className="secondary-button"
            disabled={opening || pattern.data.gridDimensions.N <= 0}
            onClick={openInBead}
          >
            拼豆预览
          </button>
        </div>
      </div>
    </main>
  );
}
