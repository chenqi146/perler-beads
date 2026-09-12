'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { usePatternStore } from '../../stores';

export default function ExplorePage() {
  const patterns = usePatternStore((s) => s.publicPatterns);
  const refreshPublicPatterns = usePatternStore((s) => s.refreshPublicPatterns);

  useEffect(() => {
    refreshPublicPatterns();
  }, [refreshPublicPatterns]);

  return (
    <main className="platform-page">
      <header className="platform-header">
        <div>
          <p className="eyebrow">COMMUNITY</p>
          <h1>公开图纸</h1>
        </div>
      </header>
      <section className="pattern-grid">
        {patterns.length ? (
          patterns.map((pattern) => (
            <Link className="pattern-card" href={`/pattern/${pattern.id}`} key={pattern.id}>
              <div className="pattern-preview">
                {pattern.data.originalImageSrc && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={pattern.data.originalImageSrc} alt="" />
                )}
              </div>
              <h2>{pattern.name}</h2>
              <p>{pattern.description || '暂无描述'}</p>
              <small>
                {pattern.data.gridDimensions.N} × {pattern.data.gridDimensions.M}
              </small>
            </Link>
          ))
        ) : (
          <p className="empty-state">还没有公开图纸。</p>
        )}
      </section>
    </main>
  );
}
