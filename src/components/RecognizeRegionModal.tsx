'use client';

import React, { useEffect, useRef, useState } from 'react';
import { CloseIcon, IconButton } from './ui/IconButton';
import { Overlay } from './ui/Overlay';

type CropBox = { x: number; y: number; w: number; h: number };
type Corner = 'nw' | 'ne' | 'sw' | 'se';
type DragMode =
  | { type: 'create'; startX: number; startY: number }
  | { type: 'move'; origin: CropBox; startX: number; startY: number }
  | { type: 'resize'; corner: Corner; origin: CropBox; startX: number; startY: number };

const HANDLE_HIT = 14;
const MIN_CROP = 8;

function clampCrop(box: CropBox, maxW: number, maxH: number): CropBox {
  let { x, y, w, h } = box;
  w = Math.max(MIN_CROP, Math.min(w, maxW));
  h = Math.max(MIN_CROP, Math.min(h, maxH));
  x = Math.max(0, Math.min(x, maxW - w));
  y = Math.max(0, Math.min(y, maxH - h));
  return { x, y, w, h };
}

function hitTestCorner(crop: CropBox, x: number, y: number): Corner | null {
  const points: Array<{ corner: Corner; cx: number; cy: number }> = [
    { corner: 'nw', cx: crop.x, cy: crop.y },
    { corner: 'ne', cx: crop.x + crop.w, cy: crop.y },
    { corner: 'sw', cx: crop.x, cy: crop.y + crop.h },
    { corner: 'se', cx: crop.x + crop.w, cy: crop.y + crop.h },
  ];
  for (const p of points) {
    if (Math.abs(x - p.cx) <= HANDLE_HIT && Math.abs(y - p.cy) <= HANDLE_HIT) {
      return p.corner;
    }
  }
  return null;
}

function pointInCrop(crop: CropBox, x: number, y: number): boolean {
  return x >= crop.x && x <= crop.x + crop.w && y >= crop.y && y <= crop.y + crop.h;
}

function resizeFromCorner(
  origin: CropBox,
  corner: Corner,
  x: number,
  y: number,
  maxW: number,
  maxH: number,
): CropBox {
  const right = origin.x + origin.w;
  const bottom = origin.y + origin.h;
  let x0 = origin.x;
  let y0 = origin.y;
  let x1 = right;
  let y1 = bottom;

  if (corner === 'nw') {
    x0 = x;
    y0 = y;
  } else if (corner === 'ne') {
    x1 = x;
    y0 = y;
  } else if (corner === 'sw') {
    x0 = x;
    y1 = y;
  } else {
    x1 = x;
    y1 = y;
  }

  return clampCrop(
    {
      x: Math.min(x0, x1),
      y: Math.min(y0, y1),
      w: Math.abs(x1 - x0),
      h: Math.abs(y1 - y0),
    },
    maxW,
    maxH,
  );
}

function cursorForHover(crop: CropBox | null, x: number, y: number): string {
  if (!crop || crop.w < 2 || crop.h < 2) return 'crosshair';
  const corner = hitTestCorner(crop, x, y);
  if (corner === 'nw' || corner === 'se') return 'nwse-resize';
  if (corner === 'ne' || corner === 'sw') return 'nesw-resize';
  if (pointInCrop(crop, x, y)) return 'move';
  return 'crosshair';
}

export type RecognizeRegionModalProps = {
  imageSrc: string;
  confirming?: boolean;
  onCancel: () => void;
  onConfirm: (croppedDataUrl: string) => void;
};

/**
 * 图纸识别前框选区域（对齐 Pindo：默认整图，确认后再识别）
 */
export function RecognizeRegionModal({
  imageSrc,
  confirming = false,
  onCancel,
  onConfirm,
}: RecognizeRegionModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const cropRef = useRef<CropBox | null>(null);
  const dragRef = useRef<DragMode | null>(null);

  const [naturalSize, setNaturalSize] = useState({ w: 0, h: 0 });
  const [displaySize, setDisplaySize] = useState({ w: 0, h: 0 });
  const [crop, setCrop] = useState<CropBox | null>(null);
  const [cursor, setCursor] = useState('crosshair');
  const [busy, setBusy] = useState(false);

  cropRef.current = crop;
  const disabled = busy || confirming;

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      const maxW = Math.min(window.innerWidth - 48, 920);
      const maxH = Math.min(window.innerHeight - 220, 560);
      const scale = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight, 1);
      const dw = Math.max(1, Math.round(img.naturalWidth * scale));
      const dh = Math.max(1, Math.round(img.naturalHeight * scale));
      setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
      setDisplaySize({ w: dw, h: dh });
      setCrop({ x: 0, y: 0, w: dw, h: dh });
    };
    img.onerror = () => {
      alert('图片加载失败，请重试');
      onCancel();
    };
    img.src = imageSrc;
  }, [imageSrc, onCancel]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !displaySize.w) return;
    canvas.width = displaySize.w;
    canvas.height = displaySize.h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, displaySize.w, displaySize.h);

    if (crop && crop.w > 0 && crop.h > 0) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.45)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.clearRect(crop.x, crop.y, crop.w, crop.h);
      ctx.drawImage(
        img,
        (crop.x / displaySize.w) * naturalSize.w,
        (crop.y / displaySize.h) * naturalSize.h,
        (crop.w / displaySize.w) * naturalSize.w,
        (crop.h / displaySize.h) * naturalSize.h,
        crop.x,
        crop.y,
        crop.w,
        crop.h,
      );

      ctx.strokeStyle = '#c47a2c';
      ctx.lineWidth = 2;
      ctx.strokeRect(crop.x + 0.5, crop.y + 0.5, crop.w - 1, crop.h - 1);

      const handles: Array<[number, number]> = [
        [crop.x, crop.y],
        [crop.x + crop.w, crop.y],
        [crop.x, crop.y + crop.h],
        [crop.x + crop.w, crop.y + crop.h],
      ];
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#c47a2c';
      for (const [hx, hy] of handles) {
        ctx.beginPath();
        ctx.rect(hx - 5, hy - 5, 10, 10);
        ctx.fill();
        ctx.stroke();
      }
    }
  }, [crop, displaySize, naturalSize]);

  const toLocal = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.min(displaySize.w, Math.max(0, clientX - rect.left)),
      y: Math.min(displaySize.h, Math.max(0, clientY - rect.top)),
    };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (disabled) return;
    const p = toLocal(e.clientX, e.clientY);
    const current = cropRef.current;

    if (current && current.w >= MIN_CROP && current.h >= MIN_CROP) {
      const corner = hitTestCorner(current, p.x, p.y);
      if (corner) {
        dragRef.current = {
          type: 'resize',
          corner,
          origin: { ...current },
          startX: p.x,
          startY: p.y,
        };
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        return;
      }
      if (pointInCrop(current, p.x, p.y)) {
        dragRef.current = {
          type: 'move',
          origin: { ...current },
          startX: p.x,
          startY: p.y,
        };
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        return;
      }
    }

    dragRef.current = { type: 'create', startX: p.x, startY: p.y };
    setCrop({ x: p.x, y: p.y, w: 0, h: 0 });
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const p = toLocal(e.clientX, e.clientY);
    const drag = dragRef.current;

    if (!drag) {
      setCursor(cursorForHover(cropRef.current, p.x, p.y));
      return;
    }

    if (drag.type === 'create') {
      setCursor('crosshair');
      setCrop({
        x: Math.min(drag.startX, p.x),
        y: Math.min(drag.startY, p.y),
        w: Math.abs(p.x - drag.startX),
        h: Math.abs(p.y - drag.startY),
      });
      return;
    }

    if (drag.type === 'move') {
      setCursor('move');
      const dx = p.x - drag.startX;
      const dy = p.y - drag.startY;
      setCrop(
        clampCrop(
          {
            x: drag.origin.x + dx,
            y: drag.origin.y + dy,
            w: drag.origin.w,
            h: drag.origin.h,
          },
          displaySize.w,
          displaySize.h,
        ),
      );
      return;
    }

    setCursor(drag.corner === 'nw' || drag.corner === 'se' ? 'nwse-resize' : 'nesw-resize');
    setCrop(resizeFromCorner(drag.origin, drag.corner, p.x, p.y, displaySize.w, displaySize.h));
  };

  const onPointerUp = () => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag) return;
    setCrop((prev) => {
      if (!prev || prev.w < MIN_CROP || prev.h < MIN_CROP) {
        return { x: 0, y: 0, w: displaySize.w, h: displaySize.h };
      }
      return clampCrop(prev, displaySize.w, displaySize.h);
    });
  };

  const resetFullCrop = () => {
    if (!displaySize.w) return;
    setCrop({ x: 0, y: 0, w: displaySize.w, h: displaySize.h });
  };

  const handleConfirm = async () => {
    if (disabled) return;
    const img = imgRef.current;
    const box = cropRef.current;
    if (!img || !box || box.w < 4 || box.h < 4) {
      alert('请先框选有效区域');
      return;
    }

    setBusy(true);
    try {
      const scaleX = naturalSize.w / displaySize.w;
      const scaleY = naturalSize.h / displaySize.h;
      const sx = Math.round(box.x * scaleX);
      const sy = Math.round(box.y * scaleY);
      const sw = Math.max(1, Math.round(box.w * scaleX));
      const sh = Math.max(1, Math.round(box.h * scaleY));

      const out = document.createElement('canvas');
      out.width = sw;
      out.height = sh;
      const ctx = out.getContext('2d');
      if (!ctx) throw new Error('无法创建画布');
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
      onConfirm(out.toDataURL('image/png'));
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : '裁剪失败，请重试');
      setBusy(false);
    }
  };

  return (
    <Overlay
      labelledBy="recognize-region-title"
      layer="import"
      onClose={disabled ? () => undefined : onCancel}
      closeOnBackdrop={!disabled}
      panelClassName="max-w-[960px] w-[min(960px,calc(100vw-1.5rem))]"
    >
      <div className="flex max-h-[min(90dvh,720px)] flex-col overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-gray-900">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[#eadfce] px-4 py-3 dark:border-gray-800">
          <div className="min-w-0">
            <h2 id="recognize-region-title" className="text-base font-semibold text-[#3a2416] dark:text-gray-100">
              请框选识别区域
            </h2>
            <p className="mt-1 text-[12px] leading-relaxed text-[#8a6a4a] dark:text-gray-400">
              默认选中整张图片；拖动框角可调整，框外拖拽可重画。确认后开始识别网格与色号。
            </p>
          </div>
          <IconButton
            aria-label="关闭"
            title="关闭"
            disabled={disabled}
            onClick={onCancel}
            className="shrink-0"
          >
            <CloseIcon />
          </IconButton>
        </div>

        <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-[#f6efe4]/20 p-3 dark:bg-gray-950/40">
          {displaySize.w > 0 ? (
            <canvas
              ref={canvasRef}
              width={displaySize.w}
              height={displaySize.h}
              className="max-w-full touch-none rounded-lg shadow-sm"
              style={{ width: displaySize.w, height: displaySize.h, cursor }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            />
          ) : (
            <p className="py-16 text-sm text-[#8a6a4a]">加载图片中…</p>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-[#eadfce] px-4 py-3 dark:border-gray-800">
          <button
            type="button"
            disabled={disabled || !displaySize.w}
            onClick={resetFullCrop}
            className="app-btn app-btn--ghost app-btn--sm"
          >
            恢复全图
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={disabled}
              onClick={onCancel}
              className="app-btn app-btn--secondary app-btn--sm"
            >
              取消
            </button>
            <button
              type="button"
              disabled={disabled || !crop}
              onClick={() => void handleConfirm()}
              className="app-btn app-btn--primary app-btn--sm"
            >
              {confirming || busy ? '识别中…' : '确认识别'}
            </button>
          </div>
        </div>
      </div>
    </Overlay>
  );
}

export default RecognizeRegionModal;
