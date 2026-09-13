'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePatternStore } from '../../stores';
import type { Pattern, Work } from '../../types/platform';
import { apiFetch } from '../../utils/apiClient';
import { useToast } from '../../components/ui/ToastProvider';

export default function ExplorePage() {
  const toast = useToast();
  const refreshPublicPatterns = usePatternStore((s) => s.refreshPublicPatterns);
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [works, setWorks] = useState<Work[]>([]);

  useEffect(() => {
    refreshPublicPatterns();
    void (async () => {
      const local = usePatternStore.getState().publicPatterns;
      try {
        const [pRes, wRes] = await Promise.all([
          apiFetch('/api/patterns?visibility=public', undefined, { authRedirect: false }),
          apiFetch('/api/works?visibility=public', undefined, { authRedirect: false }),
        ]);
        if (pRes.ok) {
          const data = await pRes.json();
          const remote = Array.isArray(data.patterns) ? (data.patterns as Pattern[]) : [];
          if (remote.length) {
            setPatterns(remote);
          } else {
            setPatterns(local);
            if (local.length) toast('暂无云端公开图纸，显示本地公开');
          }
        } else {
          setPatterns(local);
          if (pRes.status === 503) toast('云端未就绪，显示本地公开图纸');
          else toast('拉取公开图纸失败，显示本地');
        }
        if (wRes.ok) {
          const data = await wRes.json();
          setWorks(Array.isArray(data.works) ? (data.works as Work[]) : []);
        }
      } catch {
        setPatterns(local);
        toast('网络异常，显示本地公开图纸');
      }
    })();
  }, [refreshPublicPatterns, toast]);

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
              <div className="pattern-card-body pattern-card-body--padded">
                <h2>{pattern.name}</h2>
                {pattern.description ? <p>{pattern.description}</p> : null}
                <small>
                  {pattern.data.gridDimensions.N} × {pattern.data.gridDimensions.M}
                </small>
              </div>
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
