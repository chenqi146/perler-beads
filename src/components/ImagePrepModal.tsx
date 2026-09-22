'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { detectSubjectBounds } from '../domain/pixelation';
import { removeImageBackground } from '../utils/aiMatting';
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

  const next = {
    x: Math.min(x0, x1),
    y: Math.min(y0, y1),
    w: Math.abs(x1 - x0),
    h: Math.abs(y1 - y0),
  };
  return clampCrop(next, maxW, maxH);
}

function cursorForHover(crop: CropBox | null, x: number, y: number): string {
  if (!crop || crop.w < 2 || crop.h < 2) return 'crosshair';
  const corner = hitTestCorner(crop, x, y);
  if (corner === 'nw' || corner === 'se') return 'nwse-resize';
  if (corner === 'ne' || corner === 'sw') return 'nesw-resize';
  if (pointInCrop(crop, x, y)) return 'move';
  return 'crosshair';
}

interface ImagePrepModalProps {
  imageSrc: string;
  onCancel: () => void;
  onConfirm: (preparedDataUrl: string, meta: { usedAiMatting: boolean }) => void;
}

function readNaturalImageData(img: HTMLImageElement): ImageData | null {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0);
  try {
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  } catch {
    return null;
  }
}

/**
 * 上传后预处理弹窗：优先自动框选主体，可拖拽调整；可选 AI 抠图；确认后输出最终原图
 */
const ImagePrepModal: React.FC<ImagePrepModalProps> = ({ imageSrc, onCancel, onConfirm }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [naturalSize, setNaturalSize] = useState({ w: 0, h: 0 });
  const [displaySize, setDisplaySize] = useState({ w: 0, h: 0 });
  const [crop, setCrop] = useState<CropBox | null>(null);
  const [enableAiMatting, setEnableAiMatting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [subjectHint, setSubjectHint] = useState<string | null>(null);
  const [cursor, setCursor] = useState('crosshair');
  const dragRef = useRef<DragMode | null>(null);
  const cropRef = useRef<CropBox | null>(null);

  useEffect(() => {
    cropRef.current = crop;
  }, [crop]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !displaySize.w) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = displaySize.w;
    canvas.height = displaySize.h;
    ctx.clearRect(0, 0, displaySize.w, displaySize.h);
    ctx.drawImage(img, 0, 0, displaySize.w, displaySize.h);

    if (crop && crop.w > 2 && crop.h > 2) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.42)';
      ctx.beginPath();
      ctx.rect(0, 0, displaySize.w, displaySize.h);
      ctx.rect(crop.x, crop.y, crop.w, crop.h);
      ctx.fill('evenodd');

      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(crop.x + 1, crop.y + 1, crop.w - 2, crop.h - 2);

      const hs = 8;
      ctx.fillStyle = '#f59e0b';
      const corners = [
        [crop.x, crop.y],
        [crop.x + crop.w, crop.y],
        [crop.x, crop.y + crop.h],
        [crop.x + crop.w, crop.y + crop.h],
      ];
      corners.forEach(([cx, cy]) => {
        ctx.fillRect(cx - hs / 2, cy - hs / 2, hs, hs);
      });
    }
  }, [crop, displaySize]);

  const applySubjectCrop = useCallback(
    (img: HTMLImageElement, dw: number, dh: number): boolean => {
      const imageData = readNaturalImageData(img);
      if (!imageData) return false;

      const hasTransparency = (() => {
        const d = imageData.data;
        for (let i = 3; i < d.length; i += 16) {
          if (d[i] < 250) return true;
        }
        return false;
      })();

      const bounds = detectSubjectBounds(imageData.data, imageData.width, imageData.height, {
        background: hasTransparency ? 'transparent' : 'opaque',
        paddingRatio: 0.03,
      });
      if (!bounds) return false;

      const scaleX = dw / img.naturalWidth;
      const scaleY = dh / img.naturalHeight;
      setCrop({
        x: Math.max(0, Math.round(bounds.x * scaleX)),
        y: Math.max(0, Math.round(bounds.y * scaleY)),
        w: Math.max(8, Math.round(bounds.w * scaleX)),
        h: Math.max(8, Math.round(bounds.h * scaleY)),
      });
      return true;
    },
    [],
  );

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

      const found = applySubjectCrop(img, dw, dh);
      if (found) {
        setSubjectHint('已自动框选主体：框内拖移，角点缩放，框外拖拽可重画');
      } else {
        setCrop({ x: 0, y: 0, w: dw, h: dh });
        setSubjectHint('未检测到明显主体，已全选；框内拖移，角点缩放，框外重画');
      }
    };
    img.src = imageSrc;
  }, [imageSrc, applySubjectCrop]);

  useEffect(() => {
    draw();
  }, [draw]);

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
    if (busy) return;
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
        setSubjectHint(null);
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
        setSubjectHint(null);
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        return;
      }
    }

    // 框外：重新画裁剪框
    dragRef.current = { type: 'create', startX: p.x, startY: p.y };
    setCrop({ x: p.x, y: p.y, w: 0, h: 0 });
    setSubjectHint(null);
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
    setSubjectHint(null);
  };

  const handleAutoSubjectCrop = () => {
    const img = imgRef.current;
    if (!img || !displaySize.w || busy) return;
    const found = applySubjectCrop(img, displaySize.w, displaySize.h);
    if (found) {
      setSubjectHint('已自动框选主体：框内拖移，角点缩放，框外拖拽可重画');
    } else {
      setSubjectHint('未检测到明显主体，请框内拖移或框外重画');
    }
  };

  const exportCroppedDataUrl = async (): Promise<string> => {
    const img = imgRef.current;
    if (!img || !crop || crop.w < 4 || crop.h < 4) {
      throw new Error('请先框选有效区域');
    }
    const scaleX = naturalSize.w / displaySize.w;
    const scaleY = naturalSize.h / displaySize.h;
    const sx = Math.round(crop.x * scaleX);
    const sy = Math.round(crop.y * scaleY);
    const sw = Math.max(1, Math.round(crop.w * scaleX));
    const sh = Math.max(1, Math.round(crop.h * scaleY));

    const out = document.createElement('canvas');
    out.width = sw;
    out.height = sh;
    const ctx = out.getContext('2d');
    if (!ctx) throw new Error('无法创建画布');
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
    return out.toDataURL('image/png');
  };

  const handleConfirm = async () => {
    if (busy) return;
    setBusy(true);
    setProgressText(enableAiMatting ? '正在裁剪…' : '正在应用…');
    try {
      let dataUrl = await exportCroppedDataUrl();
      if (enableAiMatting) {
        setProgressText('AI 抠图中（首次需下载模型）…');
        dataUrl = await removeImageBackground(dataUrl, ({ key, current, total }) => {
          const pct = total > 0 ? Math.round((current / total) * 100) : 0;
          setProgressText(`AI 抠图 · ${key} ${pct}%`);
        });
      }
      onConfirm(dataUrl, { usedAiMatting: enableAiMatting });
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : '处理失败，请重试');
    } finally {
      setBusy(false);
      setProgressText('');
    }
  };

  return (
    <Overlay
      labelledBy="image-prep-title"
      layer="import"
      closeOnBackdrop={!busy}
      onClose={onCancel}
      panelClassName="max-w-[960px] rounded-2xl border border-gray-200 dark:border-gray-700"
    >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h3 id="image-prep-title" className="text-sm font-semibold text-gray-900 dark:text-gray-100">图片预处理</h3>
            <p className="text-[11px] text-gray-500 mt-0.5">
              {subjectHint ?? '可拖拽框选裁剪区域；需要去背景时勾选 AI 抠图，再确认生成'}
            </p>
          </div>
          <IconButton aria-label="关闭" onClick={onCancel} disabled={busy}>
            <CloseIcon />
          </IconButton>
        </div>

        <div className="p-3 flex justify-center bg-gray-100 dark:bg-gray-900/50 overflow-auto max-h-[58vh] relative">
          <canvas
            ref={canvasRef}
            className={`max-w-full touch-none rounded shadow-sm bg-white ${busy ? 'cursor-wait opacity-70' : ''}`}
            style={{
              width: displaySize.w || undefined,
              height: displaySize.h || undefined,
              cursor: busy ? 'wait' : cursor,
            }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          />
          {busy && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/35 text-white text-xs">
              <div className="mb-2 h-7 w-7 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              <p>{progressText || '处理中…'}</p>
            </div>
          )}
        </div>

        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleAutoSubjectCrop}
              disabled={busy || !displaySize.w}
              className="h-8 px-3 rounded-lg border border-amber-300 bg-amber-50 text-xs text-amber-800 disabled:opacity-40 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200"
            >
              自动框选主体
            </button>
            <button
              type="button"
              onClick={resetFullCrop}
              disabled={busy}
              className="h-8 px-3 rounded-lg border border-gray-300 dark:border-gray-600 text-xs text-gray-600 dark:text-gray-300 disabled:opacity-40"
            >
              恢复全选
            </button>
            <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200 select-none cursor-pointer">
              <input
                type="checkbox"
                checked={enableAiMatting}
                disabled={busy}
                onChange={(e) => setEnableAiMatting(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-violet-500 focus:ring-violet-400"
              />
              <span>AI 抠图去背景</span>
            </label>
            <span className="text-[11px] text-gray-400">
              {enableAiMatting ? '确认时先裁剪再抠图' : '仅裁剪后生成图纸'}
            </span>
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={busy}
              className="h-9 px-4 rounded-lg border border-gray-300 text-sm text-gray-600 disabled:opacity-40"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={busy}
              className="h-9 px-4 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium disabled:opacity-50"
            >
              {busy ? '处理中…' : '确认并生成'}
            </button>
          </div>
        </div>
    </Overlay>
  );
};

export default ImagePrepModal;
