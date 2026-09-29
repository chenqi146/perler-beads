'use client';

import type { ReactNode } from 'react';
import { cn } from '../ui/cn';
import { SiteNavSheet } from './SiteNavSheet';

type Side = 'left' | 'right';

const SIDE_GRID: Record<Side, string> = {
  left: 'lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[300px_minmax(0,1fr)]',
  right: 'lg:grid-cols-[minmax(0,1fr)_240px] xl:grid-cols-[minmax(0,1fr)_260px]',
};

/** 工作台根容器：占满 AppShell 剩余高度 */
export function WorkbenchRoot({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex min-h-0 flex-1 flex-col overflow-hidden', className)}>
      {children}
    </div>
  );
}

/** 手机顶栏（菜单 + 返回 + 标题 + 弱化模式），桌面隐藏 */
export function WorkbenchMobileHeader({
  title,
  badge,
  onBack,
  backAriaLabel = '返回',
  showSiteMenu = true,
}: {
  title: string;
  badge?: string;
  onBack: () => void;
  backAriaLabel?: string;
  /** 工作台页会隐藏全局顶栏时，用菜单进站点导航 */
  showSiteMenu?: boolean;
}) {
  return (
    <div className="mb-1.5 flex shrink-0 items-center gap-1 rounded-xl border border-[#eadfce] bg-[#fffaf3]/95 px-1.5 py-1 lg:hidden">
      {showSiteMenu ? <SiteNavSheet /> : null}
      <button
        type="button"
        onClick={onBack}
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#5c4030]"
        aria-label={backAriaLabel}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.8}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold leading-tight text-[#3a2416]" title={title}>
          {title}
        </p>
        {badge ? (
          <p className="truncate text-[10px] leading-tight text-[#a08060]">{badge}</p>
        ) : null}
      </div>
    </div>
  );
}

/** 桌面 / 手机操作提示切换 */
export function WorkbenchTips({
  desktop,
  mobile,
  className,
}: {
  desktop: string;
  mobile: string;
  className?: string;
}) {
  return (
    <>
      <p className={cn('hidden text-[11px] text-[#a08060] lg:block', className)}>{desktop}</p>
      <p className={cn('text-[11px] text-[#a08060] lg:hidden', className)}>{mobile}</p>
    </>
  );
}

/**
 * 工作台主分割：手机单列，桌面侧栏 + 主区。
 * side=left 用于编辑页；side=right 用于拼豆页。
 */
export function WorkbenchSplit({
  side,
  sidePanel,
  hideSide = false,
  children,
  className,
  sideClassName,
}: {
  side: Side;
  sidePanel?: ReactNode;
  /** 全屏专心模式时隐藏侧栏并取消间距 */
  hideSide?: boolean;
  children: ReactNode;
  className?: string;
  sideClassName?: string;
}) {
  const showSide = Boolean(sidePanel) && !hideSide;

  return (
    <div
      className={cn(
        'grid min-h-0 flex-1 overflow-hidden',
        hideSide
          ? 'grid-cols-1 gap-0'
          : cn('grid-cols-1 gap-3', SIDE_GRID[side]),
        className,
      )}
    >
      {side === 'left' && showSide ? (
        <aside
          className={cn(
            'hidden min-h-0 flex-col space-y-3 overflow-y-auto overscroll-contain pb-1 pr-0.5 lg:flex',
            sideClassName,
          )}
        >
          {sidePanel}
        </aside>
      ) : null}

      {children}

      {side === 'right' && showSide ? (
        <div className={cn('hidden min-h-0 lg:block', sideClassName)}>{sidePanel}</div>
      ) : null}
    </div>
  );
}

/** 仅桌面显示（如色块统计侧栏内嵌区） */
export function WorkbenchDesktopOnly({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn('hidden min-h-0 lg:block', className)}>{children}</div>;
}

/**
 * 手机底栏容器。
 * visibility=mobile：仅小屏；always：全屏专心模式桌面也显示。
 */
export function WorkbenchMobileFooter({
  children,
  visibility = 'mobile',
  className,
}: {
  children: ReactNode;
  visibility?: 'mobile' | 'always';
  className?: string;
}) {
  return (
    <div
      className={cn(
        'shrink-0 border-[#eadfce] bg-[#fffaf3] p-2 shadow-[0_-4px_18px_rgba(90,52,24,0.04)]',
        visibility === 'always'
          ? 'rounded-none border-t'
          : 'rounded-2xl border lg:hidden',
        className,
      )}
      style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
    >
      {children}
    </div>
  );
}
