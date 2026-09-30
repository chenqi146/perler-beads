'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  usePatternStore,
  useBeadProgressStore,
  summarizeBeadProgress,
} from '@/stores';
import type { Pattern } from '@/types/platform';
import { EmptyState } from '@/components/ui/EmptyState';
import { PatternCard } from './PatternCard';
import {
  PatternListQueryBar,
  type PatternProgressFilter,
} from './PatternListQueryBar';
import { hydrateBeadProgressFromCloud } from '@/utils/craftSessionSync';

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
    void hydrateBeadProgressFromCloud();
  }, [refreshPatterns]);

  const patterns =
    hydrated || storePatterns.length > 0 ? storePatterns : initialPatterns;

  const progressById = useMemo(() => {
    const map: Record<string, ReturnType<typeof summarizeBeadProgress>> = {};
    for (const pattern of patterns) {
      const entry = byPatternProgress[pattern.id];
      map[pattern.id] = summarizeBeadProgress(
        pattern,
        entry?.completedCells,
        entry?.manualStatus,
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
          <EmptyState
            motif="board"
            kicker="空板"
            title="这张板还空着"
            description={
              <>
                新建一张图纸，上传图片。
                <br />
                格子、色号和用量会落到这些孔上。
              </>
            }
            action={
              <Link href="/dashboard" className="primary-button">
                新建图纸
              </Link>
            }
          />
        ) : filteredPatterns.length === 0 ? (
          <EmptyState
            motif="search"
            size="compact"
            kicker="筛选"
            title="没有符合条件的图纸"
            description="换个关键词，或把进度筛选调回「全部」。"
          />
        ) : (
          filteredPatterns.map((pattern, index) => (
            <PatternCard
              key={pattern.id}
              pattern={pattern}
              summary={progressById[pattern.id]}
              index={index}
              showVisibilityBadge={false}
            />
          ))
        )}
      </section>
    </main>
  );
}
