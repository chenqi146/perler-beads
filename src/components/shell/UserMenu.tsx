'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { clearLoggedInUser, getLoggedInUser, type LoggedInUser } from '@/utils/platformStore';
import { ensureAnonymousSession, logoutRemote, onAuthChanged } from '@/utils/authClient';
import { toast } from '@/components/ui/ToastProvider';

/** 顶栏右上角：游客直接露出「登录」；正式账号显示资料下拉 */
export function UserMenu() {
  const pathname = usePathname() || '/';
  const router = useRouter();
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [user, setUser] = useState<LoggedInUser | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);

  useEffect(() => {
    setUser(getLoggedInUser());
    setHydrated(true);
    return onAuthChanged(() => setUser(getLoggedInUser()));
  }, [pathname]);

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) {
      setMenuPos(null);
      return;
    }
    const update = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      setMenuPos({
        top: rect.bottom + 6,
        right: Math.max(8, window.innerWidth - rect.right),
      });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      const menuEl = document.getElementById(menuId);
      if (menuEl?.contains(target)) return;
      setOpen(false);
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
  }, [open, menuId]);

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
    const previousId = user.id;
    await logoutRemote();
    clearLoggedInUser();
    setOpen(false);
    try {
      const next = await ensureAnonymousSession();
      if (previousId && next.id && previousId !== next.id) {
        // ensureAnonymousSession / applyAuthSuccess 已 remap
      }
      setUser(getLoggedInUser());
      toast(user.isAnonymous ? '已重置本机身份' : '已退出，继续以游客使用');
    } catch {
      setUser(null);
      toast('已退出登录');
    }
    if (!pathname.startsWith('/auth')) {
      router.refresh();
    }
  };

  const bindHref = `/auth/login?next=${encodeURIComponent(pathname)}`;

  // 游客：顶栏直接露出「登录」，避免工作台 overflow 裁切下拉导致无法进入登录页
  if (user.isAnonymous) {
    if (pathname.startsWith('/auth')) {
      return (
        <span className="px-2 text-xs text-[#8a6a4a]" title="登录后即可绑定本机数据">
          本机游客
        </span>
      );
    }
    return (
      <div ref={rootRef} className="relative flex shrink-0 items-center gap-1">
        <Link
          href={bindHref}
          className="rounded-lg bg-[#c47a2c] px-2.5 py-1.5 text-xs font-semibold text-[#fffaf3] transition-[opacity,background-color] duration-150 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e8b86a]"
        >
          登录
        </Link>
        <button
          type="button"
          ref={buttonRef}
          className="flex items-center gap-1.5 rounded-lg py-1 pl-1 pr-1.5 text-left transition-[background-color] duration-150 hover:bg-[#f3e6d4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e8b86a]"
          aria-expanded={open}
          aria-haspopup="menu"
          aria-controls={menuId}
          aria-label="本机游客菜单"
          onClick={() => setOpen((value) => !value)}
        >
          <span
            className="grid h-7 w-7 place-items-center rounded-full bg-[#e8d5bc] text-xs font-semibold text-[#5c4030]"
            aria-hidden="true"
          >
            {user.initial}
          </span>
        </button>
        {open && menuPos
          ? createPortal(
              <div
                id={menuId}
                role="menu"
                style={{ top: menuPos.top, right: menuPos.right }}
                className="fixed z-[400] w-56 overflow-hidden rounded-xl border border-[#eadfce] bg-[#fffaf3] py-1 shadow-[0_12px_28px_rgba(90,52,24,0.12)]"
              >
                <div className="border-b border-[#eadfce] px-3 py-2.5">
                  <p className="truncate text-sm font-semibold text-[#3a2416]">{user.displayName}</p>
                  <p className="mt-0.5 text-xs text-[#8a6a4a]">绑定本浏览器，清缓存会丢失</p>
                </div>
                <Link
                  href={bindHref}
                  role="menuitem"
                  className="block w-full px-3 py-2 text-left text-xs font-medium text-[#3a2416] transition-[background-color] duration-150 hover:bg-[#f3e6d4] focus-visible:outline-none focus-visible:bg-[#f3e6d4]"
                  onClick={() => setOpen(false)}
                >
                  绑定账号（跨设备）
                </Link>
                <button
                  type="button"
                  role="menuitem"
                  className="w-full px-3 py-2 text-left text-xs font-semibold text-[#a33] transition-[background-color] duration-150 hover:bg-[#f8e8e4] focus-visible:outline-none focus-visible:bg-[#f8e8e4]"
                  onClick={logout}
                >
                  重置本机身份
                </button>
              </div>,
              document.body,
            )
          : null}
      </div>
    );
  }

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        ref={buttonRef}
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

      {open && menuPos
        ? createPortal(
            <div
              id={menuId}
              role="menu"
              style={{ top: menuPos.top, right: menuPos.right }}
              className="fixed z-[400] w-56 overflow-hidden rounded-xl border border-[#eadfce] bg-[#fffaf3] py-1 shadow-[0_12px_28px_rgba(90,52,24,0.12)]"
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
              {user.isAdmin ? (
                <Link
                  href="/admin"
                  role="menuitem"
                  className="block w-full px-3 py-2 text-left text-xs font-medium text-[#3a2416] transition-[background-color] duration-150 hover:bg-[#f3e6d4] focus-visible:outline-none focus-visible:bg-[#f3e6d4]"
                  onClick={() => setOpen(false)}
                >
                  后台管理
                </Link>
              ) : null}
              <button
                type="button"
                role="menuitem"
                className="w-full px-3 py-2 text-left text-xs font-semibold text-[#a33] transition-[background-color] duration-150 hover:bg-[#f8e8e4] focus-visible:outline-none focus-visible:bg-[#f8e8e4]"
                onClick={logout}
              >
                退出登录
              </button>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
