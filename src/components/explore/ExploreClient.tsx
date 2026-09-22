'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePatternStore } from '@/stores';
import type { Pattern, Work } from '@/types/platform';
import { PatternPreviewImage } from '@/components/patterns/PatternPreviewImage';
import { useToast } from '@/components/ui/ToastProvider';

type Props = {
  initialPatterns: Pattern[];
  initialWorks: Work[];
  cloudAvailable: boolean;
};

export function ExploreClient({ initialPatterns, initialWorks, cloudAvailable }: Props) {
  const toast = useToast();
  const refreshPublicPatterns = usePatternStore((s) => s.refreshPublicPatterns);
  const [patterns, setPatterns] = useState<Pattern[]>(initialPatterns);
  const [works] = useState<Work[]>(initialWorks);

  useEffect(() => {
    refreshPublicPatterns();
    if (initialPatterns.length > 0) return;

    const local = usePatternStore.getState().publicPatterns;
    if (local.length) {
      setPatterns(local);
      toast(cloudAvailable ? '暂无云端公开图纸，显示本地公开' : '云端未就绪，显示本地公开图纸');
    }
  }, [cloudAvailable, initialPatterns.length, refreshPublicPatterns, toast]);

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
                <PatternPreviewImage
                  data={pattern.data}
                  cacheKey={`${pattern.id}:${pattern.updatedAt}`}
                />
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
