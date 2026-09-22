'use client';

import React, { useEffect, useRef, type ReactNode, type RefObject } from 'react';
import PixelatedPreviewCanvas, {
  type CanvasToolMode,
  type CropRect,
} from '../PixelatedPreviewCanvas';
import type { MappedPixel } from '../../utils/pixelation';
import type { ColorSystem } from '../../utils/colorSystemUtils';

export type EditorCanvasWorkspaceProps = {
  viewportRef: RefObject<HTMLDivElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  mappedPixelData: MappedPixel[][] | null;
  gridDimensions: { N: number; M: number } | null;
  originalImageSrc: string | null;
  previewZoom: number;
  canvasOffset: { x: number; y: number };
  panBy: (dx: number, dy: number) => void;
  highlightColorKey?: string | null;
  onHighlightComplete?: () => void;
  selectedColorSystem: ColorSystem;
  toolMode: CanvasToolMode;
  selectedCells: Set<string>;
  onSelectCells: (keys: string[], mode: 'add' | 'toggle' | 'set') => void;
  onSelectionDoubleClick?: () => void;
  cropRect: CropRect | null;
  onCropRectChange: (rect: CropRect | null) => void;
  onInteraction: (
    clientX: number,
    clientY: number,
    pageX: number,
    pageY: number,
    isClick: boolean,
    isTouchEnd?: boolean,
  ) => void;
  /** 双指捏合缩放 */
  onPinchZoom?: (scale: number, centerClient: { x: number; y: number }) => void;
  /** 色号编码；成品预览时可关掉 */
  showCellKeys?: boolean;
  /** 格子边界/坐标轴；成品预览时可关掉 */
  showGrid?: boolean;
  /** 底部工具条等叠加层 */
  children?: ReactNode;
};

/**
 * 编辑器画布视口：平移/缩放壳 + PixelatedPreviewCanvas。
 * 空格按住时点在图纸上也可平移（内部维护 pan / space refs）。
 */
export function EditorCanvasWorkspace({
  viewportRef,
  canvasRef,
  mappedPixelData,
  gridDimensions,
  originalImageSrc,
  previewZoom,
  canvasOffset,
  panBy,
  highlightColorKey,
  onHighlightComplete,
  selectedColorSystem,
  toolMode,
  selectedCells,
  onSelectCells,
  onSelectionDoubleClick,
  cropRect,
  onCropRectChange,
  onInteraction,
  onPinchZoom,
  showCellKeys,
  showGrid = true,
  children,
}: EditorCanvasWorkspaceProps) {
  const canvasPanRef = useRef<{ x: number; y: number; pointerId: number } | null>(null);
  const spaceHeldRef = useRef(false);
  const panSurfaceRef = useRef<HTMLDivElement | null>(null);
  const panByRef = useRef(panBy);
  panByRef.current = panBy;

  useEffect(() => {
    const isTypingTarget = (target: EventTarget | null) => {
      const el = target as HTMLElement | null;
      const tag = el?.tagName?.toLowerCase();
      return tag === 'input' || tag === 'textarea' || tag === 'select' || !!el?.isContentEditable;
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || isTypingTarget(event.target)) return;
      spaceHeldRef.current = true;
      event.preventDefault();
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') spaceHeldRef.current = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  // React onWheel 默认 passive，滚轮平移需要非被动监听才能 preventDefault
  useEffect(() => {
    const el = panSurfaceRef.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      panByRef.current(-event.deltaX, -event.deltaY);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [originalImageSrc, mappedPixelData, gridDimensions]);

  const hasCanvasContent =
    Boolean(originalImageSrc) ||
    Boolean(mappedPixelData?.length && gridDimensions && gridDimensions.N > 0);

  return (
    <div
      ref={viewportRef}
      className="relative min-h-0 min-w-0 flex-1 overflow-hidden rounded-lg border border-[#eadfce] bg-[#f3ebe0] dark:border-gray-800 dark:bg-gray-950"
    >
      {!hasCanvasContent ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 dark:text-gray-500">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="mb-3 h-14 w-14 opacity-50"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.25}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
            />
          </svg>
          <p className="text-sm">请先上传图片</p>
        </div>
      ) : (
        <div
          ref={panSurfaceRef}
          className="absolute inset-0 cursor-grab overflow-hidden active:cursor-grabbing"
          onPointerDown={(event) => {
            if (event.pointerType === 'touch') return;
            if (event.button !== 0) return;
            const onDrawing = !!(event.target as HTMLElement).closest('canvas');
            // 图纸上默认框选；按住空格时改为拖动画布（桌面）
            if (onDrawing && !spaceHeldRef.current) return;
            event.preventDefault();
            canvasPanRef.current = {
              x: event.clientX,
              y: event.clientY,
              pointerId: event.pointerId,
            };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            const pan = canvasPanRef.current;
            if (!pan || pan.pointerId !== event.pointerId) return;
            const dx = event.clientX - pan.x;
            const dy = event.clientY - pan.y;
            canvasPanRef.current = { ...pan, x: event.clientX, y: event.clientY };
            panBy(dx, dy);
          }}
          onPointerUp={(event) => {
            if (canvasPanRef.current?.pointerId === event.pointerId) {
              canvasPanRef.current = null;
            }
          }}
          onPointerCancel={() => {
            canvasPanRef.current = null;
          }}
        >
          <div
            className="absolute left-0 top-0"
            style={{ transform: `translate(${canvasOffset.x}px, ${canvasOffset.y}px)` }}
          >
            <div className="overflow-hidden rounded-md bg-white shadow-sm ring-1 ring-black/5 dark:bg-gray-800 dark:ring-white/10">
              <PixelatedPreviewCanvas
                canvasRef={canvasRef}
                mappedPixelData={mappedPixelData}
                gridDimensions={gridDimensions}
                onInteraction={onInteraction}
                highlightColorKey={highlightColorKey}
                onHighlightComplete={onHighlightComplete}
                selectedColorSystem={selectedColorSystem}
                previewZoom={previewZoom}
                toolMode={toolMode}
                selectedCells={selectedCells}
                onSelectCells={onSelectCells}
                onSelectionDoubleClick={onSelectionDoubleClick}
                cropRect={cropRect}
                onCropRectChange={onCropRectChange}
                onPanBy={panBy}
                onPinchZoom={onPinchZoom}
                showCellKeys={showCellKeys}
                showGrid={showGrid}
              />
            </div>
          </div>
        </div>
      )}
      {children}
    </div>
  );
}
