'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  usePatternStore,
  useBeadProgressStore,
  summarizeBeadProgress,
  beadCraftCtaLabel,
} from '@/stores';
import type { Pattern, Work } from '@/types/platform';
import { PatternPreviewImage } from '@/components/patterns/PatternPreviewImage';
import { PatternBeadProgress } from '@/components/patterns/PatternBeadProgress';
import {
  PatternListQueryBar,
  type PatternProgressFilter,
} from '@/components/patterns/PatternListQueryBar';
import { useToast } from '@/components/ui/ToastProvider';

type Props = {
  initialPatterns: Pattern[];
  initialWorks: Work[];
  cloudAvailable: boolean;
};

export function ExploreClient({ initialPatterns, initialWorks, cloudAvailable }: Props) {
  const toast = useToast();
  const refreshPublicPatterns = usePatternStore((s) => s.refreshPublicPatterns);
  const byPatternProgress = useBeadProgressStore((s) => s.byPattern);
  const [patterns, setPatterns] = useState<Pattern[]>(initialPatterns);
  const [works] = useState<Work[]>(initialWorks);
  const [query, setQuery] = useState('');
  const [progressFilter, setProgressFilter] = useState<PatternProgressFilter>('all');

  useEffect(() => {
    refreshPublicPatterns();
    if (initialPatterns.length > 0) return;

    const local = usePatternStore.getState().publicPatterns;
    if (local.length) {
      setPatterns(local);
      toast(cloudAvailable ? '暂无云端公开图纸，显示本地公开' : '云端未就绪，显示本地公开图纸');
    }
  }, [cloudAvailable, initialPatterns.length, refreshPublicPatterns, toast]);

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
          <p className="eyebrow">COMMUNITY</p>
          <h1>公开图纸</h1>
        </div>
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
          <p className="empty-state">还没有公开图纸。</p>
        ) : filteredPatterns.length === 0 ? (
          <p className="empty-state">没有符合条件的公开图纸，试试其他关键词或进度筛选。</p>
        ) : (
          filteredPatterns.map((pattern) => {
            const summary = progressById[pattern.id];
            const emptyGrid = pattern.data.gridDimensions.N <= 0;
            return (
              <article className="pattern-card" key={pattern.id}>
                <div className="pattern-card-media">
                  <Link href={`/pattern/${pattern.id}`} className="pattern-preview">
                    <PatternPreviewImage
                      data={pattern.data}
                      cacheKey={`${pattern.id}:${pattern.updatedAt}`}
                    />
                  </Link>
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
                    href={`/pattern/${pattern.id}`}
                  >
                    查看
                  </Link>
                  <Link
                    className={`primary-button touch-manipulation ${emptyGrid ? 'pointer-events-none opacity-40' : ''}`}
                    href={`/bead/${pattern.id}`}
                    aria-disabled={emptyGrid}
                  >
                    {beadCraftCtaLabel(summary.status)}
                  </Link>
                </div>
              </article>
            );
          })
        )}
      </section>

      {works.length > 0 ? (
        <>
          <header className="platform-header mt-10">
            <div>
              <p className="eyebrow">WORKS</p>
              <h1>公开作品</h1>
            </div>
          </header>
          <section className="pattern-grid">
            {works.map((work) => (
              <Link className="pattern-card" href={`/work/${work.id}`} key={work.id}>
                <div className="pattern-preview">
                  {work.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={work.imageUrl} alt={work.title} />
                  ) : null}
                </div>
                <div className="pattern-card-body pattern-card-body--padded">
                  <h2>{work.title}</h2>
                  {work.description ? <p>{work.description}</p> : null}
                </div>
              </Link>
            ))}
          </section>
        </>
      ) : null}
    </main>
  );
}
