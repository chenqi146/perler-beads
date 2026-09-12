'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useContext } from 'react';
import { NavSubtitleStateContext } from './navSubtitleContext';

const NAV_LINKS = [
  {
    href: '/dashboard',
    label: '我的图纸',
    match: (path: string) =>
      path.startsWith('/dashboard') ||
      path.startsWith('/patterns') ||
      path === '/' ||
      path.startsWith('/editor') ||
      path.startsWith('/bead'),
  },
  {
    href: '/explore',
    label: '公开浏览',
    match: (path: string) => path.startsWith('/explore') || path.startsWith('/pattern/'),
  },
  {
    href: '/works',
    label: '我的作品',
    match: (path: string) => path.startsWith('/works') || path.startsWith('/work/'),
  },
] as const;

function linkClass(active: boolean) {
  return [
    'rounded-lg px-2.5 py-1.5 text-xs font-medium transition-[background-color,color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e8b86a]',
    active
      ? 'bg-[#f3e6d4] text-[#3a2416]'
      : 'text-[#8a6a4a] hover:bg-[#f3e6d4] hover:text-[#3a2416]',
  ].join(' ');
}

/** 纯展示顶栏：品牌 + 可选副标题 + 主导航。页面操作按钮不放这里。 */
export function AppNavBar() {
  const pathname = usePathname() || '/';
  const { subtitle } = useContext(NavSubtitleStateContext);

  return (
    <header className="app-nav mb-3 flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#eadfce] bg-[#fffaf3] px-3 py-2 shadow-[0_1px_0_rgba(90,52,24,0.04)] sm:mb-4 sm:px-3.5">
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
        <Link
          href="/dashboard"
          className="shrink-0 rounded-lg px-1.5 py-1 text-sm font-semibold text-[#3a2416] transition-[background-color] duration-150 hover:bg-[#f3e6d4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e8b86a]"
        >
          喵喵的拼豆小屋
        </Link>
        {subtitle ? (
          <>
            <span className="hidden h-4 w-px shrink-0 bg-[#e0d0bc] sm:block" aria-hidden="true" />
            <span className="hidden min-w-0 truncate text-sm text-[#8a6a4a] sm:inline" title={subtitle}>
              {subtitle}
            </span>
          </>
        ) : null}
        <nav className="ml-auto flex items-center gap-0.5 overflow-x-auto sm:gap-1" aria-label="主导航">
          {NAV_LINKS.map((item) => (
            <Link key={item.href} href={item.href} className={linkClass(item.match(pathname))}>
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
