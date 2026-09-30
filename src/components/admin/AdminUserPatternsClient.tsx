'use client';

import Link from 'next/link';
import type { AdminUserRow } from '@/lib/adminQueries';
import type { Pattern } from '@/types/platform';
import { EmptyState } from '@/components/ui/EmptyState';
import { PatternPreviewImage } from '@/components/patterns/PatternPreviewImage';

type Props = {
  user: AdminUserRow;
  patterns: Pattern[];
};

export function AdminUserPatternsClient({ user, patterns }: Props) {
  const presence =
    user.isAnonymous && (user.lastIp || user.lastSeenAt || user.lastIpGeo)
      ? [
          user.lastSeenAt
            ? `最近访问 ${new Date(user.lastSeenAt).toLocaleString('zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              })}`
            : null,
          user.lastIp || null,
          user.lastIpGeo || null,
        ]
          .filter(Boolean)
          .join(' · ')
      : null;

  return (
    <main className="admin-page">
      <header className="admin-page-header">
        <div>
          <p className="eyebrow">ADMIN · USER</p>
          <h1>{user.name} 的图纸</h1>
          <p className="mt-1 text-sm text-[#8a6a4a]">
            {user.isAnonymous ? '本机游客' : user.email || '—'} · {patterns.length} 张
          </p>
          {presence ? <p className="mt-1 text-xs text-[#8a6a4a]">{presence}</p> : null}
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
                    mode="grid"
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
                  打开画布
                </Link>
              </div>
            </article>
          ))
        ) : (
          <EmptyState
            motif="quiet"
            size="compact"
            kicker="图纸"
            title="该用户还没有图纸"
            description="用户创建图纸后会出现在这里。"
          />
        )}
      </section>
    </main>
  );
}
