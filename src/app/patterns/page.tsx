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
        </div>
        <Link href="/dashboard" className="primary-button">
          新建图纸
        </Link>
      </header>
      <section className="pattern-grid">
        {patterns.length ? (
          patterns.map((pattern) => (
            <article className="pattern-card" key={pattern.id}>
              <Link href={`/editor/${pattern.id}`} className="pattern-preview">
                {pattern.data.originalImageSrc && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={pattern.data.originalImageSrc} alt="" />
                )}
              </Link>
              <h2>{pattern.name}</h2>
              <p>{pattern.description || '暂无描述'}</p>
              <small>
                {pattern.visibility === 'public' ? '公开' : '私有'} · {pattern.data.gridDimensions.N} ×{' '}
                {pattern.data.gridDimensions.M}
              </small>
              <div className="detail-actions">
                <Link className="secondary-button" href={`/editor/${pattern.id}`}>
                  编辑
                </Link>
                <Link
                  className={`primary-button ${pattern.data.gridDimensions.N <= 0 ? 'pointer-events-none opacity-40' : ''}`}
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
