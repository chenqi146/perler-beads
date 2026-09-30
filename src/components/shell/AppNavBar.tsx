'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useContext } from 'react';
import { NavSubtitleStateContext } from './navSubtitleContext';
import { APP_NAV_LINKS } from './navLinks';
import { SiteNavSheet } from './SiteNavSheet';
import { UserMenu } from './UserMenu';

function linkClass(active: boolean) {
  return [
    'rounded-lg px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition-[background-color,color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e8b86a]',
    active
      ? 'bg-[#f3e6d4] text-[#3a2416]'
      : 'text-[#8a6a4a] hover:bg-[#f3e6d4] hover:text-[#3a2416]',
  ].join(' ');
}

/** 顶栏：手机汉堡菜单；桌面横排导航 */
export function AppNavBar() {
  const pathname = usePathname() || '/';
  const { subtitle } = useContext(NavSubtitleStateContext);

  return (
    <header className="app-nav mb-2 flex shrink-0 items-center justify-between gap-2 sm:mb-4 sm:gap-3">
      <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-3">
        <SiteNavSheet className="shrink-0 lg:hidden" />
        <Link
          href="/dashboard"
          className="min-w-0 truncate rounded-lg px-0.5 py-1 text-[15px] font-semibold tracking-tight text-[#3a2416] transition-[color,opacity] duration-150 hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e8b86a] sm:text-lg"
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

      <div className="relative z-20 hidden items-center gap-1.5 rounded-2xl border border-[#eadfce] bg-[#fffaf3] px-2 py-1 shadow-[0_1px_0_rgba(90,52,24,0.04)] lg:flex">
        <nav className="flex items-center gap-1" aria-label="主导航">
          {APP_NAV_LINKS.map((item) => (
            <Link key={item.href} href={item.href} className={linkClass(item.match(pathname))}>
              {item.label}
            </Link>
          ))}
        </nav>
        <span className="h-4 w-px shrink-0 bg-[#e0d0bc]" aria-hidden="true" />
        <div className="relative z-30 shrink-0">
          <UserMenu />
        </div>
      </div>

      {/* 手机：账号入口放顶栏右侧；完整导航在汉堡菜单里 */}
      <div className="relative z-30 shrink-0 lg:hidden">
        <UserMenu />
      </div>
    </header>
  );
}
