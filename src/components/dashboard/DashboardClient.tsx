'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  usePatternStore,
  useBeadProgressStore,
  summarizeBeadProgress,
  beadCraftCtaLabel,
} from '@/stores';
import { useToast } from '@/components/ui/ToastProvider';
import type { Pattern } from '@/types/platform';
import { PatternPreviewImage } from '@/components/patterns/PatternPreviewImage';
import { PatternBeadProgress } from '@/components/patterns/PatternBeadProgress';
import {
  PatternListQueryBar,
  type PatternProgressFilter,
} from '@/components/patterns/PatternListQueryBar';

type Props = {
  initialPatterns: Pattern[];
};

export function DashboardClient({ initialPatterns }: Props) {
  const router = useRouter();
  const toast = useToast();
  const storePatterns = usePatternStore((s) => s.patterns);
  const refreshPatterns = usePatternStore((s) => s.refreshPatterns);
  const savePattern = usePatternStore((s) => s.savePattern);
  const deletePattern = usePatternStore((s) => s.deletePattern);
  const byPatternProgress = useBeadProgressStore((s) => s.byPattern);
  const [hydrated, setHydrated] = useState(false);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [query, setQuery] = useState('');
  const [progressFilter, setProgressFilter] = useState<PatternProgressFilter>('all');

  useEffect(() => {
    refreshPatterns();
    void usePatternStore
      .getState()
      .refreshPatternsFromCloud()
      .finally(() => setHydrated(true));
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

  const create = () => {
    if (!name.trim()) return;
    const raw = savePattern({
      name: name.trim(),
      description,
      tags: [],
      visibility: 'private',
      data: {
        mappedPixelData: [],
        gridDimensions: { N: 0, M: 0 },
        colorCounts: null,
        totalBeadCount: 0,
        originalImageSrc: null,
        originalImageKey: null,
        selectedColorSystem: 'MARD',
      },
    });
    router.push(`/editor/${raw.id}`);
  };

  const toggleVisibility = (pattern: Pattern) => {
    const next = pattern.visibility === 'public' ? 'private' : 'public';
    savePattern(
      {
        name: pattern.name,
        description: pattern.description,
        tags: pattern.tags,
        visibility: next,
        data: pattern.data,
      },
      pattern.id,
    );
    toast(next === 'public' ? '已设为公开，会出现在公开浏览' : '已设为私有');
  };

  return (
    <main className="platform-page">
      <header className="platform-header">
        <div>
          <p className="eyebrow">MY PATTERNS</p>
          <h1>我的图纸</h1>
          <p className="mt-1 text-sm text-[#8a6a4a] lg:hidden">选图纸编辑或开始拼豆</p>
        </div>
        <button
          type="button"
          className="primary-button touch-manipulation"
          onClick={() => setOpen(true)}
        >
          新建图纸
        </button>
      </header>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#3a2416]/40 p-4 overscroll-contain">
          <div className="w-full max-w-md rounded-2xl border border-[#eadfce] bg-[#fffaf3] p-6 shadow-[0_24px_60px_rgba(90,52,24,0.18)]">
            <h2 className="text-xl font-semibold text-[#3a2416]">创建图纸</h2>
            <label className="mt-5 block text-sm font-medium text-[#5c4030]">
              图纸名称
              <input
                className="mt-2 h-11 w-full rounded-xl border border-[#e0d0bc] bg-white px-3 focus-visible:border-[#c47a2c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e8b86a]"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="off"
                autoFocus
              />
            </label>
            <label className="mt-4 block text-sm font-medium text-[#5c4030]">
              描述
              <textarea
                className="mt-2 min-h-20 w-full rounded-xl border border-[#e0d0bc] bg-white px-3 py-2 focus-visible:border-[#c47a2c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e8b86a]"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                autoComplete="off"
              />
            </label>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" className="secondary-button" onClick={() => setOpen(false)}>
                取消
              </button>
              <button type="button" className="primary-button" onClick={create}>
                创建并编辑
              </button>
            </div>
          </div>
        </div>
      )}

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
          <p className="empty-state">还没有图纸，先新建一张吧。</p>
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
                <div className="pattern-card-actions">
                  <Link
                    href={`/editor/${pattern.id}`}
                    className="secondary-button touch-manipulation"
                  >
                    编辑
                  </Link>
                  <Link
                    href={`/bead/${pattern.id}`}
                    className={`primary-button touch-manipulation ${emptyGrid ? 'pointer-events-none opacity-40' : ''}`}
                    aria-disabled={emptyGrid}
                  >
                    {beadCraftCtaLabel(summary.status)}
                  </Link>
                </div>
                <div className="pattern-card-tools">
                  <button type="button" onClick={() => toggleVisibility(pattern)}>
                    {pattern.visibility === 'public' ? '取消公开' : '设为公开'}
                  </button>
                  <span aria-hidden="true">·</span>
                  <button
                    type="button"
                    className="danger"
                    onClick={() => {
                      deletePattern(pattern.id);
                      toast('已删除');
                    }}
                  >
                    删除
                  </button>
                </div>
              </article>
            );
          })
        )}
      </section>
    </main>
  );
}
