'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { removeImageBackground } from '../utils/aiMatting';
import { CloseIcon, IconButton } from './ui/IconButton';
import { Overlay } from './ui/Overlay';

type CropBox = { x: number; y: number; w: number; h: number };

interface ImagePrepModalProps {
  imageSrc: string;
  onCancel: () => void;
  onConfirm: (preparedDataUrl: string, meta: { usedAiMatting: boolean }) => void;
}

/**
 * 上传后预处理弹窗：默认全选裁剪框，可调整；可选 AI 抠图；确认后输出最终原图
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
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const draggingRef = useRef(false);

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

      // 四角把手提示
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
      // 默认全选
      setCrop({ x: 0, y: 0, w: dw, h: dh });
    };
    img.src = imageSrc;
  }, [imageSrc]);

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
    draggingRef.current = true;
    dragStartRef.current = p;
    setCrop({ x: p.x, y: p.y, w: 0, h: 0 });
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current || !dragStartRef.current) return;
    const p = toLocal(e.clientX, e.clientY);
    const x0 = dragStartRef.current.x;
    const y0 = dragStartRef.current.y;
    setCrop({
      x: Math.min(x0, p.x),
      y: Math.min(y0, p.y),
      w: Math.abs(p.x - x0),
      h: Math.abs(p.y - y0),
    });
  };

  const onPointerUp = () => {
    draggingRef.current = false;
    dragStartRef.current = null;
    // 拖太小则恢复全选
    setCrop((prev) => {
      if (!prev || prev.w < 8 || prev.h < 8) {
        return { x: 0, y: 0, w: displaySize.w, h: displaySize.h };
      }
      return prev;
    });
  };

  const resetFullCrop = () => {
    if (!displaySize.w) return;
    setCrop({ x: 0, y: 0, w: displaySize.w, h: displaySize.h });
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
              已默认全选，可拖拽重新框选裁剪区域；需要去背景时勾选 AI 抠图，再确认生成
            </p>
          </div>
          <IconButton aria-label="关闭" onClick={onCancel} disabled={busy}>
            <CloseIcon />
          </IconButton>
        </div>

        <div className="p-3 flex justify-center bg-gray-100 dark:bg-gray-900/50 overflow-auto max-h-[58vh] relative">
          <canvas
            ref={canvasRef}
            className={`max-w-full touch-none rounded shadow-sm bg-white ${busy ? 'cursor-wait opacity-70' : 'cursor-crosshair'}`}
            style={{ width: displaySize.w || undefined, height: displaySize.h || undefined }}
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
