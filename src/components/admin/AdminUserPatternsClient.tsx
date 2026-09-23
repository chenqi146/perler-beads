'use client';

import Link from 'next/link';
import type { AdminUserRow } from '@/lib/adminQueries';
import type { Pattern } from '@/types/platform';
import { PatternPreviewImage } from '@/components/patterns/PatternPreviewImage';

type Props = {
  user: AdminUserRow;
  patterns: Pattern[];
};

export function AdminUserPatternsClient({ user, patterns }: Props) {
  return (
    <main className="platform-page">
      <header className="platform-header">
        <div>
          <p className="eyebrow">ADMIN · USER</p>
          <h1>{user.name} 的图纸</h1>
          <p className="mt-1 text-sm text-[#8a6a4a]">
            {user.isAnonymous ? '本机游客' : user.email || '—'} · {patterns.length} 张
          </p>
        </div>
        <Link href="/admin" className="secondary-button">
          返回用户列表
        </Link>
      </header>

      <section className="pattern-grid">
        {patterns.length ? (
          patterns.map((pattern) => (
            <article className="pattern-card" key={pattern.id}>
              <div className="pattern-card-media">
                <Link href={`/admin/patterns/${pattern.id}`} className="pattern-preview">
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
              <div className="pattern-card-actions">
                <Link
                  href={`/admin/patterns/${pattern.id}`}
                  className="primary-button touch-manipulation"
                >
                  查看
                </Link>
              </div>
            </article>
          ))
        ) : (
          <p className="empty-state">该用户还没有图纸。</p>
        )}
      </section>
    </main>
  );
}
