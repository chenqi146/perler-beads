'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePatternStore } from '../../stores';
import type { Pattern, Work } from '../../types/platform';

export default function ExplorePage() {
  const refreshPublicPatterns = usePatternStore((s) => s.refreshPublicPatterns);
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [works, setWorks] = useState<Work[]>([]);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    refreshPublicPatterns();
    void (async () => {
      const local = usePatternStore.getState().publicPatterns;
      try {
        const [pRes, wRes] = await Promise.all([
          fetch('/api/patterns?visibility=public', { credentials: 'include' }),
          fetch('/api/works?visibility=public', { credentials: 'include' }),
        ]);
        if (pRes.ok) {
          const data = await pRes.json();
          const remote = Array.isArray(data.patterns) ? (data.patterns as Pattern[]) : [];
          if (remote.length) {
            setPatterns(remote);
            setNote(null);
          } else {
            setPatterns(local);
            setNote(local.length ? '暂无云端公开图纸，显示本地公开' : null);
          }
        } else {
          setPatterns(local);
          setNote('云端不可用，显示本地公开图纸');
        }
        if (wRes.ok) {
          const data = await wRes.json();
          setWorks(Array.isArray(data.works) ? (data.works as Work[]) : []);
        }
      } catch {
        setPatterns(local);
        setNote('网络异常，显示本地公开图纸');
      }
    })();
  }, [refreshPublicPatterns]);

  return (
    <main className="platform-page">
      <header className="platform-header">
        <div>
          <p className="eyebrow">COMMUNITY</p>
          <h1>公开图纸</h1>
          {note ? <p className="mt-1 text-xs text-[#8a6a4a]">{note}</p> : null}
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
                <h2>{work.title}</h2>
                <p>{work.description || '暂无描述'}</p>
              </Link>
            ))}
          </section>
        </>
      ) : null}
    </main>
  );
}
