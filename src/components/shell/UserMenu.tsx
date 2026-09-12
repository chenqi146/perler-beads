'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import { clearLoggedInUser, getLoggedInUser, type LoggedInUser } from '@/utils/platformStore';
import { logoutRemote } from '@/utils/authClient';

/** 顶栏右上角：已登录展示头像+昵称下拉；未登录展示登录入口 */
export function UserMenu() {
  const pathname = usePathname() || '/';
  const router = useRouter();
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [user, setUser] = useState<LoggedInUser | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setUser(getLoggedInUser());
    setHydrated(true);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  if (!hydrated) {
    return <div className="h-8 w-8 shrink-0" aria-hidden="true" />;
  }

  if (!user) {
    if (pathname.startsWith('/auth')) return null;
    return (
      <Link
        href="/auth/login"
        className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-[#8a6a4a] transition-[background-color,color] duration-150 hover:bg-[#f3e6d4] hover:text-[#3a2416] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e8b86a]"
      >
        登录
      </Link>
    );
  }

  const logout = async () => {
    await logoutRemote();
    clearLoggedInUser();
    setOpen(false);
    setUser(null);
    router.push('/auth/login');
  };

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-1.5 text-left transition-[background-color] duration-150 hover:bg-[#f3e6d4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e8b86a] sm:pr-2"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
      >
        <span
          className="grid h-7 w-7 place-items-center rounded-full bg-[#c47a2c] text-xs font-semibold text-[#fffaf3]"
          aria-hidden="true"
        >
          {user.initial}
        </span>
        <span className="hidden max-w-[7.5rem] truncate text-xs font-medium text-[#3a2416] sm:inline">
          {user.displayName}
        </span>
        <span
          className={`hidden text-[#8a6a4a] transition-transform duration-150 sm:inline ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        >
          ▾
        </span>
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          className="absolute right-0 z-50 mt-1.5 w-56 overflow-hidden rounded-xl border border-[#eadfce] bg-[#fffaf3] py-1 shadow-[0_12px_28px_rgba(90,52,24,0.12)]"
        >
          <div className="border-b border-[#eadfce] px-3 py-2.5">
            <p className="truncate text-sm font-semibold text-[#3a2416]">{user.displayName}</p>
            {user.email ? (
              <p className="mt-0.5 truncate text-xs text-[#8a6a4a]">{user.email}</p>
            ) : null}
          </div>
          <Link
            href="/profile"
            role="menuitem"
            className="block w-full px-3 py-2 text-left text-xs font-medium text-[#3a2416] transition-[background-color] duration-150 hover:bg-[#f3e6d4] focus-visible:outline-none focus-visible:bg-[#f3e6d4]"
            onClick={() => setOpen(false)}
          >
            个人信息
          </Link>
          <button
            type="button"
            role="menuitem"
            className="w-full px-3 py-2 text-left text-xs font-semibold text-[#a33] transition-[background-color] duration-150 hover:bg-[#f8e8e4] focus-visible:outline-none focus-visible:bg-[#f8e8e4]"
            onClick={logout}
          >
            退出登录
          </button>
        </div>
      ) : null}
    </div>
  );
}
