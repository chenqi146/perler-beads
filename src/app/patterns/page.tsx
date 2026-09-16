'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { usePatternStore } from '../../stores';
import RequireAuth from '../../components/RequireAuth';

function PatternsContent() {
  const patterns = usePatternStore((s) => s.patterns);
  const refreshPatterns = usePatternStore((s) => s.refreshPatterns);

  useEffect(() => {
    refreshPatterns();
  }, [refreshPatterns]);

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
      <section className="pattern-grid">
        {patterns.length ? (
          patterns.map((pattern) => (
            <article className="pattern-card" key={pattern.id}>
              <div className="pattern-card-media">
                <Link
                  href={
                    pattern.data.gridDimensions.N > 0
                      ? `/bead/${pattern.id}`
                      : `/editor/${pattern.id}`
                  }
                  className="pattern-preview"
                >
                  {pattern.data.originalImageSrc ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={pattern.data.originalImageSrc} alt="" />
                  ) : (
                    <span>暂无预览</span>
                  )}
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
              <div className="pattern-card-actions pattern-card-actions--footer">
                <Link
                  className="secondary-button touch-manipulation"
                  href={`/editor/${pattern.id}`}
                >
                  编辑
                </Link>
                <Link
                  className={`primary-button touch-manipulation ${pattern.data.gridDimensions.N <= 0 ? 'pointer-events-none opacity-40' : ''}`}
                  href={`/bead/${pattern.id}`}
                  aria-disabled={pattern.data.gridDimensions.N <= 0}
                >
                  开始拼豆
                </Link>
              </div>
            </article>
          ))
        ) : (
          <p className="empty-state">还没有图纸，先创建一张吧。</p>
        )}
      </section>
    </main>
  );
}

export default function PatternsPage() {
  return (
    <RequireAuth>
      <PatternsContent />
    </RequireAuth>
  );
}
