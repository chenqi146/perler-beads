'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { listWorks } from '../../../utils/platformStore';
import type { Work } from '../../../types/platform';

export default function WorkDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [work, setWork] = useState<Work>();
  useEffect(() => setWork(listWorks().find((item) => item.id === id)), [id]);

  if (!work) {
    return (
      <main className="platform-page">
        <p className="empty-state">作品不存在。</p>
      </main>
    );
  }

  return (
    <main className="platform-page">
      <header className="platform-header">
        <div>
          <p className="eyebrow">{work.visibility === 'public' ? 'PUBLIC' : 'PRIVATE'}</p>
          <h1>{work.title}</h1>
        </div>
        <Link href="/works" className="secondary-button">
          返回我的作品
        </Link>
      </header>
      <p style={{ color: '#8a6a4a' }}>{work.description}</p>
      {work.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="work-image" src={work.imageUrl} alt={work.title} width={720} height={720} />
      )}
    </main>
  );
}
