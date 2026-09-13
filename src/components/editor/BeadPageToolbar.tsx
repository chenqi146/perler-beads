'use client';

import Link from 'next/link';
import { EditorZoomControls } from './EditorZoomControls';

type BeadPageToolbarProps = {
  patternId: string;
  previewZoom: number;
  canFit: boolean;
  onFitCanvas: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onZoomIn: () => void;
};

/** 拼豆页内操作栏：返回编辑 / 缩放（不放进 Nav） */
export function BeadPageToolbar({
  patternId,
  previewZoom,
  canFit,
  onFitCanvas,
  onZoomOut,
  onResetZoom,
  onZoomIn,
}: BeadPageToolbarProps) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-1">
      <Link
        href={`/?patternId=${encodeURIComponent(patternId)}`}
        className="inline-flex h-9 items-center rounded-xl border border-[#e0d0bc] bg-white px-3 text-sm font-medium text-[#5c4030] transition-[background-color] duration-150 hover:bg-[#fff4e6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e8b86a]"
      >
        返回编辑
      </Link>
      <div className="flex items-center rounded-xl border border-[#e0d0bc] bg-white px-0.5">
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
