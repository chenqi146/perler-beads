'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  usePatternStore,
  useBeadProgressStore,
  summarizeBeadProgress,
  beadCraftCtaLabel,
} from '@/stores';
import type { Pattern } from '@/types/platform';
import { PatternPreviewImage } from './PatternPreviewImage';
import { PatternBeadProgress } from './PatternBeadProgress';
import {
  PatternListQueryBar,
  type PatternProgressFilter,
} from './PatternListQueryBar';

type Props = {
  initialPatterns: Pattern[];
};

export function PatternsClient({ initialPatterns }: Props) {
  const storePatterns = usePatternStore((s) => s.patterns);
  const refreshPatterns = usePatternStore((s) => s.refreshPatterns);
  const byPatternProgress = useBeadProgressStore((s) => s.byPattern);
  const [hydrated, setHydrated] = useState(false);
  const [query, setQuery] = useState('');
  const [progressFilter, setProgressFilter] = useState<PatternProgressFilter>('all');

  useEffect(() => {
    refreshPatterns();
    setHydrated(true);
  }, [refreshPatterns]);

  const patterns =
    hydrated || storePatterns.length > 0 ? storePatterns : initialPatterns;

  const progressById = useMemo(() => {
    const map: Record<string, ReturnType<typeof summarizeBeadProgress>> = {};
    for (const pattern of patterns) {
      map[pattern.id] = summarizeBeadProgress(
        pattern,
        byPatternProgress[pattern.id]?.completedCells,
      );
    }
    return map;
  }, [patterns, byPatternProgress]);

  const filteredPatterns = useMemo(() => {
    const q = query.trim().toLowerCase();
    return patterns.filter((pattern) => {
      const summary = progressById[pattern.id];
      if (progressFilter !== 'all' && summary.status !== progressFilter) return false;
      if (!q) return true;
      const haystack = `${pattern.name} ${pattern.description || ''}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [patterns, progressById, progressFilter, query]);

  return (
    <main className="platform-page">
      <header className="platform-header">
        <div>
          <p className="eyebrow">MY PATTERNS</p>
          <h1>我的图纸</h1>
          <p className="mt-1 text-sm text-[#8a6a4a] lg:hidden">选图纸编辑或开始拼豆</p>
        </div>
        <Link href="/dashboard" className="primary-button touch-manipulation">
          新建图纸
        </Link>
      </header>

      {patterns.length > 0 ? (
        <PatternListQueryBar
          query={query}
          onQueryChange={setQuery}
          progressFilter={progressFilter}
          onProgressFilterChange={setProgressFilter}
          resultCount={filteredPatterns.length}
          totalCount={patterns.length}
        />
      ) : null}

      <section className="pattern-grid">
        {patterns.length === 0 ? (
          <p className="empty-state">还没有图纸，先创建一张吧。</p>
        ) : filteredPatterns.length === 0 ? (
          <p className="empty-state">没有符合条件的图纸，试试其他关键词或进度筛选。</p>
        ) : (
          filteredPatterns.map((pattern) => {
            const summary = progressById[pattern.id];
            const emptyGrid = pattern.data.gridDimensions.N <= 0;
            return (
              <article className="pattern-card" key={pattern.id}>
                <div className="pattern-card-media">
                  <Link href={`/editor/${pattern.id}`} className="pattern-preview">
                    <PatternPreviewImage
                      data={pattern.data}
                      cacheKey={`${pattern.id}:${pattern.updatedAt}`}
                    />
                  </Link>
                  <span
                    className={`pattern-badge ${pattern.visibility === 'public' ? 'is-public' : 'is-private'}`}
                  >
                    {pattern.visibility === 'public' ? '公开' : '私有'}
                  </span>
                </div>
                <div className="pattern-card-body">
                  <h2>{pattern.name}</h2>
                  {pattern.description ? <p>{pattern.description}</p> : null}
                  <small>
                    {pattern.data.gridDimensions.N} × {pattern.data.gridDimensions.M}
                  </small>
                </div>
                <PatternBeadProgress
                  patternId={pattern.id}
                  summary={summary}
                  disabled={emptyGrid}
                />
                <div className="pattern-card-actions pattern-card-actions--footer">
                  <Link
                    className="secondary-button touch-manipulation"
                    href={`/editor/${pattern.id}`}
                  >
                    编辑
                  </Link>
                  <Link
                    className={`primary-button touch-manipulation ${emptyGrid ? 'pointer-events-none opacity-40' : ''}`}
                    href={`/bead/${pattern.id}`}
                    aria-disabled={emptyGrid}
                  >
                    {beadCraftCtaLabel(summary?.status ?? 'empty')}
                  </Link>
                </div>
              </article>
            );
          })
        )}
      </section>
    </main>
  );
}
