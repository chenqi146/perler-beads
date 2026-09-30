'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Overlay } from '../ui/Overlay';
import { APP_NAV_LINKS } from './navLinks';
import { UserMenu } from './UserMenu';

function MenuIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

/** 手机站点菜单：汉堡按钮 + 底部弹出导航 */
export function SiteNavSheet({
  className,
  triggerClassName,
}: {
  className?: string;
  triggerClassName?: string;
}) {
  const pathname = usePathname() || '/';
  const [open, setOpen] = useState(false);

  return (
    <div className={className}>
      <button
        type="button"
        className={
          triggerClassName ??
          'inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#5c4030] transition-colors hover:bg-[#f3e6d4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e8b86a]'
        }
        aria-label="打开菜单"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <MenuIcon />
      </button>

      {open ? (
        <Overlay
          placement="sheet"
          layer="content"
          labelledBy="site-nav-sheet-title"
          onClose={() => setOpen(false)}
          panelClassName="max-h-[min(72dvh,520px)] border border-[#eadfce]"
        >
          <div className="flex items-center justify-between gap-3 border-b border-[#eadfce] px-4 py-3">
            <div className="min-w-0">
              <p id="site-nav-sheet-title" className="text-sm font-semibold text-[#3a2416]">
                喵喵的拼豆小屋
              </p>
              <p className="mt-0.5 text-[11px] text-[#8a6a4a]">选择页面</p>
            </div>
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#8a6a4a] hover:bg-[#f3e6d4]"
              aria-label="关闭菜单"
              onClick={() => setOpen(false)}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                className="h-4 w-4"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>

          <nav className="flex flex-col gap-1 p-3" aria-label="主导航">
            {APP_NAV_LINKS.map((item) => {
              const active = item.match(pathname);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={[
                    'rounded-xl px-3 py-3 text-sm font-medium transition-colors',
                    active
                      ? 'bg-[#f3e6d4] text-[#3a2416]'
                      : 'text-[#5c4030] hover:bg-[#fff4e6]',
                  ].join(' ')}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center justify-between gap-3 border-t border-[#eadfce] px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <span className="text-xs text-[#8a6a4a]">账号</span>
            <UserMenu />
          </div>
        </Overlay>
      ) : null}
    </div>
  );
}
