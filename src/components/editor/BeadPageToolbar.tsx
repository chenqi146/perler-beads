'use client';

import Link from 'next/link';
import { EditorZoomControls } from './EditorZoomControls';
import { IconButton } from '../ui/IconButton';

type BeadPageToolbarProps = {
  patternId: string;
  previewZoom: number;
  canFit: boolean;
  onFitCanvas: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onZoomIn: () => void;
  /** 打开拍照上传 */
  onOpenPhoto?: () => void;
  immersive?: boolean;
  onToggleImmersive?: () => void;
  /** 沉浸模式下隐藏返回/拍照等次要入口，只留缩放与退出全屏 */
  compact?: boolean;
};

/** 拼豆页内操作栏：返回图纸 / 缩放 / 拍照 / 全屏（不放进 Nav） */
export function BeadPageToolbar({
  patternId,
  previewZoom,
  canFit,
  onFitCanvas,
  onZoomOut,
  onResetZoom,
  onZoomIn,
  onOpenPhoto,
  immersive = false,
  onToggleImmersive,
  compact = false,
}: BeadPageToolbarProps) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-1">
      {!compact ? (
        <>
          <Link
            href="/dashboard"
            className="inline-flex h-11 touch-manipulation items-center rounded-xl border border-[#e0d0bc] bg-white px-3 text-sm font-medium text-[#5c4030] transition-[background-color] duration-150 hover:bg-[#fff4e6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e8b86a] lg:h-9"
          >
            返回图纸
          </Link>
          <Link
            href={`/?patternId=${encodeURIComponent(patternId)}`}
            className="hidden h-9 items-center rounded-xl border border-[#e0d0bc] bg-white px-3 text-sm font-medium text-[#5c4030] transition-[background-color] duration-150 hover:bg-[#fff4e6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e8b86a] lg:inline-flex"
          >
            返回编辑
          </Link>
          {onOpenPhoto ? (
            <button
              type="button"
              onClick={onOpenPhoto}
              className="inline-flex h-11 touch-manipulation items-center gap-1 rounded-xl border border-[#e0d0bc] bg-white px-3 text-sm font-medium text-[#5c4030] transition-[background-color] duration-150 hover:bg-[#fff4e6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e8b86a] lg:h-9"
              aria-label="拍照上传作品"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
                <path d="M4 5a2 2 0 00-2 2v7a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2h-1.172a2 2 0 01-1.414-.586l-.828-.828A2 2 0 0010.172 3H9.828a2 2 0 00-1.414.586l-.828.828A2 2 0 016.172 5H4zm6 9a3 3 0 100-6 3 3 0 000 6z" />
              </svg>
              <span className="lg:inline">拍照</span>
            </button>
          ) : null}
        </>
      ) : null}
      <div className="flex items-center rounded-xl border border-[#e0d0bc] bg-white/95 px-0.5 shadow-sm backdrop-blur-sm">
        {onToggleImmersive ? (
          <IconButton
            aria-label={immersive ? '退出全屏' : '全屏拼豆'}
            title={immersive ? '退出全屏' : '全屏拼豆'}
            isActive={immersive}
            onClick={onToggleImmersive}
          >
            {immersive ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 9H4v5M15 9h5v5M9 15H4v-5M15 15h5v-5" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3" />
              </svg>
            )}
          </IconButton>
        ) : null}
        <EditorZoomControls
          previewZoom={previewZoom}
          canFit={canFit}
          onFit={onFitCanvas}
          onZoomOut={onZoomOut}
          onResetZoom={onResetZoom}
          onZoomIn={onZoomIn}
        />
      </div>
    </div>
  );
}
