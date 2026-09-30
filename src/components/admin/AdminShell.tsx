'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { LayoutGrid, Users } from 'lucide-react';

const NAV = [
  {
    href: '/admin',
    label: '用户管理',
    match: (path: string) => path === '/admin' || path.startsWith('/admin/users'),
    icon: Users,
  },
  {
    href: '/admin/patterns',
    label: '图纸管理',
    match: (path: string) => path.startsWith('/admin/patterns'),
    icon: LayoutGrid,
  },
] as const;

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() || '/admin';

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar" aria-label="后台导航">
        <div className="admin-sidebar-brand">
          <p className="eyebrow">ADMIN</p>
          <p className="admin-sidebar-title">后台管理</p>
        </div>
        <nav className="admin-nav">
          {NAV.map((item) => {
            const active = item.match(pathname);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={['admin-nav-link', active ? 'is-active' : ''].filter(Boolean).join(' ')}
                aria-current={active ? 'page' : undefined}
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <Link href="/dashboard" className="admin-sidebar-exit">
          返回前台
        </Link>
      </aside>

      <div className="admin-main">{children}</div>
    </div>
  );
}
