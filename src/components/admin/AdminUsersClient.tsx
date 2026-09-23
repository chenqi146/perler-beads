'use client';

import Link from 'next/link';
import type { AdminUserRow } from '@/lib/adminQueries';

type Props = {
  initialUsers: AdminUserRow[];
  adminEmail: string;
};

function formatTime(ts: number) {
  if (!ts) return '—';
  try {
    return new Date(ts).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

export function AdminUsersClient({ initialUsers, adminEmail }: Props) {
  const registered = initialUsers.filter((u) => !u.isAnonymous);
  const guests = initialUsers.filter((u) => u.isAnonymous);

  return (
    <main className="platform-page">
      <header className="platform-header">
        <div>
          <p className="eyebrow">ADMIN</p>
          <h1>用户管理</h1>
          <p className="mt-1 text-sm text-[#8a6a4a]">
            管理员账号：{adminEmail} · 共 {registered.length} 个注册用户
            {guests.length > 0 ? ` · ${guests.length} 个游客` : ''}
          </p>
        </div>
        <Link href="/dashboard" className="secondary-button">
          返回图纸
        </Link>
      </header>

      <section className="mx-auto max-w-3xl overflow-hidden rounded-2xl border border-[#eadfce] bg-[#fffaf3]">
        {registered.length === 0 && guests.length === 0 ? (
          <p className="empty-state p-6">暂无用户。</p>
        ) : (
          <ul className="divide-y divide-[#eadfce]">
            {[...registered, ...guests].map((user) => (
              <li key={user.id}>
                <Link
                  href={`/admin/users/${user.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3.5 transition-colors hover:bg-[#f3e6d4]/60 focus-visible:outline-none focus-visible:bg-[#f3e6d4]"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-[#3a2416]">
                      {user.name}
                      {user.isAnonymous ? (
                        <span className="ml-2 text-xs font-normal text-[#8a6a4a]">游客</span>
                      ) : null}
                      {user.email === adminEmail ? (
                        <span className="ml-2 text-xs font-normal text-[#c47a2c]">管理员</span>
                      ) : null}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-[#8a6a4a]">
                      {user.isAnonymous ? '本机游客' : user.email || '—'} · 注册于{' '}
                      {formatTime(user.createdAt)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold text-[#3a2416]">{user.patternCount}</p>
                    <p className="text-xs text-[#8a6a4a]">张图纸</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
