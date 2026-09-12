'use client';

import { IconButton } from '../ui/IconButton';

export type EditorZoomControlsProps = {
  previewZoom: number;
  canFit: boolean;
  onFit: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onZoomIn: () => void;
};

/** 画布缩放控制：适应 / 缩小 / 百分比重置 / 放大 */
export function EditorZoomControls({
  previewZoom,
  canFit,
  onFit,
  onZoomOut,
  onResetZoom,
  onZoomIn,
}: EditorZoomControlsProps) {
  return (
    <>
      <span className="mx-1 h-5 w-px shrink-0 bg-gray-200 dark:bg-gray-700" />
      <IconButton aria-label="适应画布" title="适应画布并居中" disabled={!canFit} onClick={onFit}>
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 9V5a1 1 0 011-1h4M15 4h4a1 1 0 011 1v4M20 15v4a1 1 0 01-1 1h-4M9 20H5a1 1 0 01-1-1v-4" />
        </svg>
      </IconButton>
      <IconButton aria-label="缩小" title="缩小" onClick={onZoomOut}>
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
        </svg>
      </IconButton>
      <button
        type="button"
        title="重置为 100%"
        onClick={onResetZoom}
        className="h-9 min-w-[3rem] shrink-0 rounded-lg px-1.5 text-[11px] font-medium text-gray-600 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-gray-300 dark:hover:bg-gray-800"
      >
        {Math.round(previewZoom * 100)}%
      </button>
      <IconButton aria-label="放大" title="放大" onClick={onZoomIn}>
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
      </IconButton>
    </>
  );
}
