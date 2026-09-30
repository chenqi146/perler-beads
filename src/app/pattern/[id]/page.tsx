'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  usePatternStore,
  useBeadProgressStore,
  summarizeBeadProgress,
  beadCraftCtaLabel,
} from '../../../stores';
import type { Pattern } from '../../../types/platform';
import { EmptyState } from '../../../components/ui/EmptyState';
import { PatternBeadProgress } from '../../../components/patterns/PatternBeadProgress';
import { PatternPreviewImage } from '../../../components/patterns/PatternPreviewImage';

export default function PatternDetail() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const loadPattern = usePatternStore((s) => s.loadPattern);
  const duplicatePattern = usePatternStore((s) => s.duplicatePattern);
  const completedCells = useBeadProgressStore(
    (s) => s.byPattern[params.id]?.completedCells,
  );
  const manualStatus = useBeadProgressStore(
    (s) => s.byPattern[params.id]?.manualStatus,
  );
  const [pattern, setPattern] = useState<Pattern | null | undefined>(undefined);

  useEffect(() => {
    setPattern(loadPattern(params.id));
  }, [params.id, loadPattern]);

  const summary = useMemo(
    () =>
      pattern
        ? summarizeBeadProgress(pattern, completedCells, manualStatus)
        : null,
    [pattern, completedCells, manualStatus],
  );

  if (!pattern || !summary) {
    return (
      <main className="platform-page">
        <EmptyState
          motif="quiet"
          kicker="图纸"
          title="图纸不存在"
          description="可能已被删除，或链接已经失效。"
          action={
            <Link href="/explore" className="primary-button">
              回公开浏览
            </Link>
          }
        />
      </main>
    );
  }

  const emptyGrid = pattern.data.gridDimensions.N <= 0;

  return (
    <main className="platform-page">
      <header className="platform-header">
        <div>
          <p className="eyebrow">PATTERN</p>
          <h1>{pattern.name}</h1>
        </div>
      </header>
      <p style={{ color: '#8a6a4a', marginTop: 0 }}>{pattern.description || '暂无描述'}</p>

      <div className="mx-auto mt-4 max-w-lg overflow-hidden rounded-2xl border border-[#eadfce] bg-[#fffaf3]">
        <div className="aspect-square bg-[#f3e6d4]">
          <PatternPreviewImage
            data={pattern.data}
            cacheKey={`${pattern.id}:${pattern.updatedAt}`}
          />
        </div>
        <PatternBeadProgress
          patternId={pattern.id}
          summary={summary}
          mappedPixelData={pattern.data.mappedPixelData}
          disabled={emptyGrid}
          patternSnapshot={pattern.data}
        />
        <div className="detail-actions px-4 pb-4">
          <Link
            href={`/bead/${pattern.id}`}
            className={`primary-button ${emptyGrid ? 'pointer-events-none opacity-40' : ''}`}
            aria-disabled={emptyGrid}
          >
            {beadCraftCtaLabel(summary.status)}
          </Link>
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              const copy = duplicatePattern(pattern.id);
              if (copy) router.push(`/editor/${copy.id}`);
            }}
          >
            复制并编辑
          </button>
          <Link href="/explore" className="secondary-button">
            返回公开图纸
          </Link>
        </div>
      </div>
    </main>
  );
}
