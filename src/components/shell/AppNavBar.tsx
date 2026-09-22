'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useContext } from 'react';
import { NavSubtitleStateContext } from './navSubtitleContext';
import { UserMenu } from './UserMenu';

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
    'rounded-lg px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition-[background-color,color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e8b86a]',
    active
      ? 'bg-[#f3e6d4] text-[#3a2416]'
      : 'text-[#8a6a4a] hover:bg-[#f3e6d4] hover:text-[#3a2416]',
  ].join(' ');
}

/** 顶栏：左侧品牌在条外；右侧短 nav + 用户菜单。
 *  移动端上下分行，避免品牌与胶囊导航互相遮挡。 */
export function AppNavBar() {
  const pathname = usePathname() || '/';
  const { subtitle } = useContext(NavSubtitleStateContext);

  return (
    <header className="app-nav mb-3 flex shrink-0 flex-col gap-2 sm:mb-4 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <Link
          href="/dashboard"
          className="min-w-0 truncate rounded-lg px-0.5 py-1 text-base font-semibold tracking-tight text-[#3a2416] transition-[color,opacity] duration-150 hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e8b86a] sm:shrink-0 sm:text-lg"
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
      </div>

      <div className="flex w-full items-center justify-between gap-1 rounded-2xl border border-[#eadfce] bg-[#fffaf3] px-1.5 py-1 shadow-[0_1px_0_rgba(90,52,24,0.04)] sm:w-fit sm:max-w-full sm:shrink-0 sm:justify-start sm:gap-1.5 sm:overflow-x-auto sm:px-2">
        <nav className="flex min-w-0 flex-1 items-center justify-around gap-0.5 sm:flex-none sm:justify-start sm:gap-1" aria-label="主导航">
          {NAV_LINKS.map((item) => (
            <Link key={item.href} href={item.href} className={linkClass(item.match(pathname))}>
              {item.label}
            </Link>
          ))}
        </nav>
        <span className="hidden h-4 w-px shrink-0 bg-[#e0d0bc] sm:block" aria-hidden="true" />
        <UserMenu />
      </div>
    </header>
  );
}
