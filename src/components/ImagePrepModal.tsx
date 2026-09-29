'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { UploadMode } from '../application/editor/editorUiStore';
import type {
  ImagePrepConfirmMeta,
  ImagePrepInitialSettings,
} from '../application/editor/imagePrepTypes';
import { detectSubjectBounds, PixelationMode } from '../domain/pixelation';
import { removeImageBackground } from '../utils/aiMatting';
import {
  colorSystemOptions,
  type ColorSystem,
} from '../utils/colorSystemUtils';
import { CloseIcon, IconButton } from './ui/IconButton';
import { Overlay } from './ui/Overlay';
import { Switch } from './ui/Switch';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export type { ImagePrepConfirmMeta, ImagePrepInitialSettings };

function clampGridSize(n: number): number {
  return Math.max(10, Math.min(300, Math.round(n) || 10));
}

function heightFromWidth(width: number, aspectRatio: number): number {
  return clampGridSize(width * Math.max(0.05, aspectRatio));
}

function widthFromHeight(height: number, aspectRatio: number): number {
  return clampGridSize(height / Math.max(0.05, aspectRatio));
}

/** 宽:高 → 高/宽，用于网格尺寸 */
const GRID_RATIO_PRESETS = [
  { id: '1:1', label: '1:1', hw: 1 },
  { id: '4:3', label: '4:3', hw: 3 / 4 },
  { id: '3:4', label: '3:4', hw: 4 / 3 },
  { id: '16:9', label: '16:9', hw: 9 / 16 },
  { id: 'crop', label: '原图', hw: null as number | null },
] as const;

type GridRatioPresetId = (typeof GRID_RATIO_PRESETS)[number]['id'];

function matchRatioPresetId(hw: number): GridRatioPresetId | null {
  for (const preset of GRID_RATIO_PRESETS) {
    if (preset.hw == null) continue;
    if (Math.abs(hw - preset.hw) < 0.04) return preset.id;
  }
  return null;
}

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
  uploadMode: UploadMode;
  onUploadModeChange: (mode: UploadMode) => void;
  initialSettings: ImagePrepInitialSettings;
  onCancel: () => void;
  onConfirm: (preparedDataUrl: string, meta: ImagePrepConfirmMeta) => void | Promise<void>;
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
 * 上传后处理弹窗：内含「图片转像素 / 图纸识别」切换；框选裁剪后按模式生成或识别
 */
const ImagePrepModal: React.FC<ImagePrepModalProps> = ({
  imageSrc,
  uploadMode,
  onUploadModeChange,
  initialSettings,
  onCancel,
  onConfirm,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [naturalSize, setNaturalSize] = useState({ w: 0, h: 0 });
  const [displaySize, setDisplaySize] = useState({ w: 0, h: 0 });
  const [crop, setCrop] = useState<CropBox | null>(null);
  const [enableAiMatting, setEnableAiMatting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [subjectHint, setSubjectHint] = useState<string | null>(null);
  const [gridWidthInput, setGridWidthInput] = useState(String(initialSettings.gridWidth));
  const [gridHeightInput, setGridHeightInput] = useState(String(initialSettings.gridHeight));
  const [keepAspectRatio, setKeepAspectRatio] = useState(initialSettings.keepAspectRatio);
  const [maxColorCount, setMaxColorCount] = useState(initialSettings.maxColorCount);
  const [selectedColorSystem, setSelectedColorSystem] = useState<ColorSystem>(
    initialSettings.selectedColorSystem,
  );
  const [ditheringEnabled, setDitheringEnabled] = useState(initialSettings.ditheringEnabled);
  const [pixelationMode, setPixelationMode] = useState<PixelationMode>(
    initialSettings.pixelationMode,
  );
  /** 识别默认按设定尺寸，避免自动检出覆盖用户输入（如 85→43） */
  const [preferAutoGrid, setPreferAutoGrid] = useState(false);
  /** 高/宽，供「保持比例」联动；与快捷比例芯片独立 */
  const [gridAspectRatio, setGridAspectRatio] = useState(() => {
    const w = Math.max(1, initialSettings.gridWidth);
    const h = Math.max(1, initialSettings.gridHeight);
    return h / w;
  });
  const [ratioPresetId, setRatioPresetId] = useState<GridRatioPresetId | null>(() =>
    matchRatioPresetId(initialSettings.gridHeight / Math.max(1, initialSettings.gridWidth)),
  );
  const cropAspectRef = useRef(1);
  const [cursor, setCursor] = useState('crosshair');
  const dragRef = useRef<DragMode | null>(null);
  const cropRef = useRef<CropBox | null>(null);

  useEffect(() => {
    cropRef.current = crop;
  }, [crop]);

  useEffect(() => {
    if (!crop || crop.w < 2 || crop.h < 2) return;
    const ratio = crop.h / crop.w;
    cropAspectRef.current = ratio;
    // 仅在选了「原图」且开启保持比例时，跟随裁剪框比例
    if (!keepAspectRatio || ratioPresetId !== 'crop') return;
    setGridAspectRatio(ratio);
    const width = clampGridSize(Number(gridWidthInput) || initialSettings.gridWidth);
    setGridHeightInput(String(heightFromWidth(width, ratio)));
  }, [
    crop,
    keepAspectRatio,
    ratioPresetId,
    gridWidthInput,
    initialSettings.gridWidth,
  ]);

  const applyGridWidth = (raw: string) => {
    const width = clampGridSize(Number(raw) || initialSettings.gridWidth);
    setGridWidthInput(String(width));
    if (keepAspectRatio) {
      setGridHeightInput(String(heightFromWidth(width, gridAspectRatio)));
    }
  };

  const applyGridHeight = (raw: string) => {
    const height = clampGridSize(Number(raw) || initialSettings.gridHeight);
    if (keepAspectRatio) {
      const width = widthFromHeight(height, gridAspectRatio);
      setGridWidthInput(String(width));
      setGridHeightInput(String(heightFromWidth(width, gridAspectRatio)));
      return;
    }
    setGridHeightInput(String(height));
  };

  const applyRatioPreset = (id: GridRatioPresetId) => {
    const width = clampGridSize(Number(gridWidthInput) || initialSettings.gridWidth);
    const hw = id === 'crop' ? cropAspectRef.current : (GRID_RATIO_PRESETS.find((p) => p.id === id)?.hw ?? 1);
    const height = heightFromWidth(width, hw);
    setGridAspectRatio(hw);
    setRatioPresetId(id);
    setGridWidthInput(String(width));
    setGridHeightInput(String(height));
  };

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
      const sideBarW = window.innerWidth >= 768 ? 320 : 24;
      const maxW = Math.min(window.innerWidth - 64 - sideBarW, 780);
      const maxH = Math.min(window.innerHeight - 160, 720);
      const scale = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight, 1);
      const dw = Math.max(1, Math.round(img.naturalWidth * scale));
      const dh = Math.max(1, Math.round(img.naturalHeight * scale));
      setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
      setDisplaySize({ w: dw, h: dh });

      if (uploadMode === 'recognize') {
        setCrop({ x: 0, y: 0, w: dw, h: dh });
        setEnableAiMatting(false);
        setSubjectHint('默认选中整图；拖动框角可调整，确认后识别网格与色号');
        return;
      }

      const found = applySubjectCrop(img, dw, dh);
      if (found) {
        setSubjectHint('已自动框选主体：框内拖移，角点缩放，框外拖拽可重画');
      } else {
        setCrop({ x: 0, y: 0, w: dw, h: dh });
        setSubjectHint('未检测到明显主体，已全选；框内拖移，角点缩放，框外重画');
      }
    };
    img.src = imageSrc;
    // 仅随图片变化初始化；模式切换由 handleModeChange 处理框选
    // eslint-disable-next-line react-hooks/exhaustive-deps -- uploadMode 仅作首帧默认
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

  const handleModeChange = (mode: UploadMode) => {
    if (busy || mode === uploadMode) return;
    onUploadModeChange(mode);
    if (mode === 'recognize') {
      if (displaySize.w) {
        setCrop({ x: 0, y: 0, w: displaySize.w, h: displaySize.h });
      }
      setEnableAiMatting(false);
      setSubjectHint('默认选中整图；拖动框角可调整，确认后识别网格与色号');
    } else {
      handleAutoSubjectCrop();
    }
  };

  const handleConfirm = async () => {
    if (busy) return;
    const isRecognize = uploadMode === 'recognize';
    const useMatting = !isRecognize && enableAiMatting;
    setBusy(true);
    setProgressText(useMatting ? '正在裁剪…' : isRecognize ? '正在裁剪识别区域…' : '正在应用…');
    try {
      let dataUrl = await exportCroppedDataUrl();
      if (useMatting) {
        setProgressText('AI 抠图中（首次需下载模型）…');
        dataUrl = await removeImageBackground(dataUrl, ({ key, current, total }) => {
          const pct = total > 0 ? Math.round((current / total) * 100) : 0;
          setProgressText(`AI 抠图 · ${key} ${pct}%`);
        });
      }
      if (isRecognize) {
        setProgressText('正在识别图纸…');
      }
      const gridWidth = clampGridSize(Number(gridWidthInput) || initialSettings.gridWidth);
      const gridHeight = keepAspectRatio
        ? heightFromWidth(gridWidth, gridAspectRatio)
        : clampGridSize(Number(gridHeightInput) || initialSettings.gridHeight);
      await onConfirm(dataUrl, {
        usedAiMatting: useMatting,
        mode: uploadMode,
        gridWidth,
        gridHeight,
        keepAspectRatio,
        maxColorCount: Math.max(0, Math.min(50, Math.round(maxColorCount) || 0)),
        selectedColorSystem,
        preferAutoGrid: uploadMode === 'recognize' ? preferAutoGrid : false,
        ditheringEnabled,
        pixelationMode,
      });
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : '处理失败，请重试');
    } finally {
      setBusy(false);
      setProgressText('');
    }
  };

  const title = uploadMode === 'recognize' ? '图纸识别' : '图片转像素';
  const hint =
    subjectHint ??
    (uploadMode === 'recognize'
      ? '默认选中整图；拖动框角可调整，确认后识别网格与色号'
      : '可拖拽框选裁剪区域；需要去背景时勾选 AI 抠图，再确认生成');
  const confirmLabel =
    busy
      ? uploadMode === 'recognize'
        ? '识别中…'
        : '处理中…'
      : uploadMode === 'recognize'
        ? '确认识别'
        : '确认并生成';

  return (
    <Overlay
      labelledBy="image-prep-title"
      layer="import"
      closeOnBackdrop={!busy}
      onClose={onCancel}
      panelClassName="flex h-[min(92dvh,920px)] w-full max-w-[1100px] flex-col overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700"
    >
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-200 px-4 py-3 dark:border-gray-700">
        <div className="min-w-0">
          <h3 id="image-prep-title" className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {title}
          </h3>
          <p className="mt-0.5 text-[11px] text-gray-500">{hint}</p>
        </div>
        <IconButton aria-label="关闭" onClick={onCancel} disabled={busy}>
          <CloseIcon />
        </IconButton>
      </div>

      <div className="shrink-0 px-4 pt-3 pb-2">
        <div
          className="grid grid-cols-2 gap-1 rounded-lg bg-[#f6efe4] p-1 dark:bg-gray-800"
          role="group"
          aria-label="处理模式"
        >
          <button
            type="button"
            disabled={busy}
            onClick={() => handleModeChange('generate')}
            className={`rounded-md px-2 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
              uploadMode === 'generate'
                ? 'bg-white text-[#3a2416] shadow-sm dark:bg-gray-700 dark:text-gray-100'
                : 'text-[#8a6a4a] hover:text-[#3a2416] dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            图片转像素
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => handleModeChange('recognize')}
            className={`rounded-md px-2 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
              uploadMode === 'recognize'
                ? 'bg-white text-[#3a2416] shadow-sm dark:bg-gray-700 dark:text-gray-100'
                : 'text-[#8a6a4a] hover:text-[#3a2416] dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            图纸识别
          </button>
        </div>
      </div>

      {/* 手机：上图下参；桌面：左右分栏。参数区用绝对定位滚动层，避免 iOS 滚不动 */}
      <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_42%] overflow-hidden md:grid-cols-[minmax(0,1fr)_300px] md:grid-rows-[minmax(0,1fr)]">
        {/* 预览 */}
        <div className="relative flex min-h-0 min-w-0 items-center justify-center overflow-hidden bg-gray-100 p-3 dark:bg-gray-900/50">
          <canvas
            ref={canvasRef}
            className={`max-h-full max-w-full touch-none rounded bg-white shadow-sm ${busy ? 'cursor-wait opacity-70' : ''}`}
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
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/35 text-xs text-white">
              <div className="mb-2 h-7 w-7 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              <p>{progressText || '处理中…'}</p>
            </div>
          )}
        </div>

        {/* 外层定高 + 内层 absolute 滚动，保证形成可滑动区域 */}
        <div className="relative min-h-0 border-t border-gray-200 bg-[#faf6f0] dark:border-gray-700 dark:bg-gray-800/60 md:border-l md:border-t-0">
          <aside
            className={`absolute inset-0 overflow-y-scroll overscroll-y-contain p-3 [-webkit-overflow-scrolling:touch] ${
              busy ? 'pointer-events-none opacity-50' : ''
            }`}
          >
          <div className="space-y-3 pb-2">
            <div className="flex flex-wrap gap-2">
              {uploadMode === 'generate' ? (
                <button
                  type="button"
                  onClick={handleAutoSubjectCrop}
                  disabled={busy || !displaySize.w}
                  className="h-8 rounded-lg border border-amber-300 bg-amber-50 px-3 text-xs text-amber-800 disabled:opacity-40 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200"
                >
                  自动框选主体
                </button>
              ) : null}
              <button
                type="button"
                onClick={resetFullCrop}
                disabled={busy}
                className="h-8 rounded-lg border border-gray-300 px-3 text-xs text-gray-600 disabled:opacity-40 dark:border-gray-600 dark:text-gray-300"
              >
                恢复全选
              </button>
            </div>

            {uploadMode === 'generate' ? (
              <Switch
                checked={enableAiMatting}
                disabled={busy}
                onChange={setEnableAiMatting}
                label="AI 抠图去背景"
                description={enableAiMatting ? '确认时先裁剪再抠图' : '仅裁剪后生成图纸'}
              />
            ) : (
              <Switch
                checked={preferAutoGrid}
                disabled={busy}
                onChange={setPreferAutoGrid}
                label="自动检测网格"
                description={
                  preferAutoGrid
                    ? '开启后将忽略下方尺寸（失败才回退）'
                    : '请框选纯格子区域（去掉图例/坐标）'
                }
              />
            )}

            <div className="space-y-3 rounded-xl border border-[#eadfce] bg-white/80 p-3 dark:border-gray-600 dark:bg-gray-900/40">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-medium text-gray-600 dark:text-gray-300">图纸尺寸</label>
                <span className="text-[11px] font-medium tabular-nums text-amber-600 dark:text-amber-400">
                  {uploadMode === 'recognize' && preferAutoGrid
                    ? '自动检测'
                    : `${clampGridSize(Number(gridWidthInput) || initialSettings.gridWidth)}×${
                        keepAspectRatio
                          ? heightFromWidth(
                              clampGridSize(Number(gridWidthInput) || initialSettings.gridWidth),
                              gridAspectRatio,
                            )
                          : clampGridSize(Number(gridHeightInput) || initialSettings.gridHeight)
                      }`}
                </span>
              </div>

              {(uploadMode === 'generate' || !preferAutoGrid) && (
                <>
                  <div>
                    <p className="mb-1.5 text-[11px] text-gray-500 dark:text-gray-400">快捷比例</p>
                    <div className="flex flex-wrap gap-1.5" role="group" aria-label="快捷比例">
                      {GRID_RATIO_PRESETS.map((preset) => {
                        const selected = ratioPresetId === preset.id;
                        return (
                          <button
                            key={preset.id}
                            type="button"
                            disabled={busy}
                            onClick={() => applyRatioPreset(preset.id)}
                            aria-pressed={selected}
                            className={`h-7 rounded-lg border px-2 text-[11px] font-medium transition-colors disabled:opacity-40 ${
                              selected
                                ? 'border-[#c47a2c] bg-[#fff4e6] text-[#8a4e18]'
                                : 'border-[#e0d0bc] bg-white text-[#5a4030] hover:border-[#d4b896] dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200'
                            }`}
                          >
                            {preset.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <Switch
                    checked={keepAspectRatio}
                    disabled={busy}
                    onChange={(next) => {
                      setKeepAspectRatio(next);
                      if (next) {
                        const width = clampGridSize(
                          Number(gridWidthInput) || initialSettings.gridWidth,
                        );
                        const height = clampGridSize(
                          Number(gridHeightInput) || initialSettings.gridHeight,
                        );
                        const hw = height / Math.max(1, width);
                        setGridAspectRatio(hw);
                        setRatioPresetId(matchRatioPresetId(hw));
                        setGridHeightInput(String(heightFromWidth(width, hw)));
                      }
                    }}
                    label="保持比例"
                    description="开启后拖动宽或高，另一边按当前比例联动"
                  />
                </>
              )}

              <div>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <label className="text-xs text-gray-500 dark:text-gray-400">宽度</label>
                  <span className="text-[11px] tabular-nums text-[#a08060]">
                    {clampGridSize(Number(gridWidthInput) || initialSettings.gridWidth)}
                  </span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={300}
                  step={1}
                  disabled={busy || (uploadMode === 'recognize' && preferAutoGrid)}
                  value={clampGridSize(Number(gridWidthInput) || initialSettings.gridWidth)}
                  onChange={(e) => applyGridWidth(e.target.value)}
                  className="w-full accent-amber-500 disabled:opacity-50"
                  aria-label="网格宽度"
                />
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <label className="text-xs text-gray-500 dark:text-gray-400">高度</label>
                  <span className="text-[11px] tabular-nums text-[#a08060]">
                    {keepAspectRatio
                      ? heightFromWidth(
                          clampGridSize(Number(gridWidthInput) || initialSettings.gridWidth),
                          gridAspectRatio,
                        )
                      : clampGridSize(Number(gridHeightInput) || initialSettings.gridHeight)}
                  </span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={300}
                  step={1}
                  disabled={busy || (uploadMode === 'recognize' && preferAutoGrid)}
                  value={
                    keepAspectRatio
                      ? heightFromWidth(
                          clampGridSize(Number(gridWidthInput) || initialSettings.gridWidth),
                          gridAspectRatio,
                        )
                      : clampGridSize(Number(gridHeightInput) || initialSettings.gridHeight)
                  }
                  onChange={(e) => applyGridHeight(e.target.value)}
                  className="w-full accent-amber-500 disabled:opacity-50"
                  aria-label="网格高度"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-600 dark:text-gray-300">
                色板品牌
              </label>
              <Select
                disabled={busy}
                value={selectedColorSystem}
                onValueChange={(value) => setSelectedColorSystem(value as ColorSystem)}
              >
                <SelectTrigger
                  className="h-9 w-full border-[#e0d0bc] bg-white px-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                  aria-label="色板品牌"
                >
                  <SelectValue placeholder="选择色板品牌" />
                </SelectTrigger>
                <SelectContent position="popper" align="start">
                  <SelectGroup>
                    {colorSystemOptions.map((option) => (
                      <SelectItem key={option.key} value={option.key}>
                        {option.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between gap-2">
                <label className="text-xs font-medium text-gray-600 dark:text-gray-300">限制用色</label>
                <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
                  {maxColorCount === 0 ? '无限制' : `${maxColorCount} 色`}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={50}
                step={1}
                disabled={busy}
                value={maxColorCount}
                onChange={(e) => setMaxColorCount(Number(e.target.value))}
                className="w-full accent-amber-500 disabled:opacity-50"
                aria-label="限制拼豆颜色数量"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-600 dark:text-gray-300">
                处理模式
              </label>
              <Select
                disabled={busy}
                value={pixelationMode}
                onValueChange={(value) => setPixelationMode(value as PixelationMode)}
              >
                <SelectTrigger
                  className="h-9 w-full border-[#e0d0bc] bg-white px-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                  aria-label="处理模式"
                >
                  <SelectValue placeholder="选择处理模式" />
                </SelectTrigger>
                <SelectContent position="popper" align="start">
                  <SelectGroup>
                    <SelectItem value={PixelationMode.EdgeAware}>清晰 (保线稿)</SelectItem>
                    <SelectItem value={PixelationMode.Dominant}>卡通 (主色)</SelectItem>
                    <SelectItem value={PixelationMode.Average}>真实 (平均)</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <Switch
              checked={ditheringEnabled}
              disabled={busy}
              onChange={setDitheringEnabled}
              label="颜色抖动"
              description="适合照片渐变；卡通/线稿建议关闭。确认后同步到外层"
            />
          </div>
          </aside>
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-end gap-2 border-t border-[#eadfce] bg-[#fffaf3] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] dark:border-gray-700 dark:bg-gray-900">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="h-10 min-w-[4.5rem] rounded-lg border border-gray-300 px-4 text-sm text-gray-600 disabled:opacity-40"
        >
          取消
        </button>
        <button
          type="button"
          onClick={() => void handleConfirm()}
          disabled={busy}
          className="h-10 min-w-[6.5rem] rounded-lg bg-amber-500 px-4 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50"
        >
          {confirmLabel}
        </button>
      </div>
    </Overlay>
  );
};

export default ImagePrepModal;
