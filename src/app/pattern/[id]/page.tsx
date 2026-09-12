'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { usePatternStore } from '../../../stores';
import type { Pattern } from '../../../types/platform';

export default function PatternDetail() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const loadPattern = usePatternStore((s) => s.loadPattern);
  const duplicatePattern = usePatternStore((s) => s.duplicatePattern);
  const [pattern, setPattern] = useState<Pattern | null | undefined>(undefined);

  useEffect(() => {
    setPattern(loadPattern(params.id));
  }, [params.id, loadPattern]);

  if (!pattern) {
    return (
      <main className="platform-page">
        <p className="empty-state">图纸不存在。</p>
      </main>
    );
  }

  return (
    <main className="platform-page">
      <header className="platform-header">
        <div>
          <p className="eyebrow">PATTERN</p>
          <h1>{pattern.name}</h1>
        </div>
      </header>
      <p style={{ color: '#8a6a4a', marginTop: 0 }}>{pattern.description || '暂无描述'}</p>
      <div className="detail-actions">
        <button
          type="button"
          className="primary-button"
          onClick={() => {
            if (!localStorage.getItem('perler-user-id')) {
              router.push('/auth/login');
              return;
            }
            const copy = duplicatePattern(pattern.id);
            if (copy) router.push(`/editor/${copy.id}`);
          }}
        >
          复制并编辑
        </button>
        <Link href="/explore" className="secondary-button">
          返回公开图纸
        </Link>
      </div>
    </main>
  );
}
