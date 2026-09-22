'use client';

import React, { useEffect, useRef, useState, MouseEvent, TouchEvent } from 'react';
import { MappedPixel } from '../utils/pixelation';
import { getConnectedRegion, TRANSPARENT_KEY } from '../domain/pixelation';
import { ColorSystem, getDisplayColorKey } from '../utils/colorSystemUtils';
import { getContrastColor, getHighlightRenderStyle } from '../utils/color';

export type CanvasToolMode = 'select' | 'crop' | 'bead';

export type CropRect = {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
};

interface PixelatedPreviewCanvasProps {
  mappedPixelData: MappedPixel[][] | null;
  gridDimensions: { N: number; M: number } | null;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  onInteraction: (
    clientX: number,
    clientY: number,
    pageX: number,
    pageY: number,
    isClick: boolean,
    isTouchEnd?: boolean
  ) => void;
  highlightColorKey?: string | null;
  /** 为 true 时高亮一直保持，直到 highlightColorKey 清空 */
  persistentHighlight?: boolean;
  onHighlightComplete?: () => void;
  selectedColorSystem?: ColorSystem;
  previewZoom?: number;
  /** select=多选格子；crop=拖拽裁剪框 */
  toolMode?: CanvasToolMode;
  selectedCells?: Set<string>;
  onSelectCells?: (keys: string[], mode: 'add' | 'toggle' | 'set') => void;
  onSelectionDoubleClick?: () => void;
  cropRect?: CropRect | null;
  onCropRectChange?: (rect: CropRect | null) => void;
  /** 空格 / 中键 / 空白处拖动时平移画布 */
  onPanBy?: (dx: number, dy: number) => void;
  /** 双指捏合：scale 为相对上一帧的倍率，center 为 client 坐标 */
  onPinchZoom?: (scale: number, centerClient: { x: number; y: number }) => void;
  /** 粗分割线间隔（每 N 格一条），默认 10 */
  gridInterval?: number;
  /** 高亮时其他颜色淡化强度 0–1，默认 0.84 */
  highlightFade?: number;
  /** 是否在色块上显示色号编码；默认自动（格子够大时显示） */
  showCellKeys?: boolean;
  /** 是否绘制格子边界、分割线与坐标轴；关闭后接近成品观感 */
  showGrid?: boolean;
}

export function cellKey(row: number, col: number): string {
  return `${row},${col}`;
}

function drawPixelatedCanvas(
  dataToDraw: MappedPixel[][],
  canvas: HTMLCanvasElement,
  dims: { N: number; M: number },
  options: {
    highlightColorKey?: string | null;
    persistentHighlight?: boolean;
    isHighlighting?: boolean;
    isDarkMode: boolean;
    selectedColorSystem: ColorSystem;
    cellSize: number;
    axisSize: number;
    gridInterval: number;
    selectedCells?: Set<string>;
    cropRect?: CropRect | null;
    highlightFade?: number;
    showCellKeys?: boolean;
    showGrid?: boolean;
  }
) {
  const {
    highlightColorKey,
    persistentHighlight = false,
    isHighlighting,
    isDarkMode,
    selectedColorSystem,
    cellSize,
    axisSize,
    gridInterval,
    selectedCells,
    cropRect,
    highlightFade = 0.84,
    showCellKeys,
    showGrid = true,
  } = options;

  const { N, M } = dims;
  const gridWidth = N * cellSize;
  const gridHeight = M * cellSize;
  const canvasWidth = axisSize + gridWidth + axisSize;
  const canvasHeight = axisSize + gridHeight + axisSize;

  if (canvas.width !== canvasWidth || canvas.height !== canvasHeight) {
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const externalBackgroundColor = isDarkMode ? '#374151' : '#F3F4F6';
  const axisBg = isDarkMode ? '#1f2937' : '#F5F5F5';
  const axisText = isDarkMode ? '#e5e7eb' : '#333333';
  // 小格子边界：灰色；分割线（每 N 格）：橙色更醒目
  const gridLineColor = isDarkMode ? '#6B7280' : '#9CA3AF';
  const sectionLineColor = '#F97316';

  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  if (showGrid) {
    ctx.fillStyle = axisBg;
    ctx.fillRect(axisSize, 0, gridWidth, axisSize);
    ctx.fillRect(axisSize, axisSize + gridHeight, gridWidth, axisSize);
    ctx.fillRect(0, axisSize, axisSize, gridHeight);
    ctx.fillRect(axisSize + gridWidth, axisSize, axisSize, gridHeight);
    ctx.fillRect(0, 0, axisSize, axisSize);
    ctx.fillRect(axisSize + gridWidth, 0, axisSize, axisSize);
    ctx.fillRect(0, axisSize + gridHeight, axisSize, axisSize);
    ctx.fillRect(axisSize + gridWidth, axisSize + gridHeight, axisSize, axisSize);

    const axisFontSize = Math.max(9, Math.min(12, Math.floor(axisSize * 0.45)));
    ctx.font = `${axisFontSize}px sans-serif`;
    ctx.fillStyle = axisText;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let i = 0; i < N; i++) {
      if ((i + 1) % gridInterval === 0 || i === 0 || i === N - 1) {
        const numX = axisSize + i * cellSize + cellSize / 2;
        ctx.fillText(String(i + 1), numX, axisSize / 2);
        ctx.fillText(String(i + 1), numX, axisSize + gridHeight + axisSize / 2);
      }
    }
    for (let j = 0; j < M; j++) {
      if ((j + 1) % gridInterval === 0 || j === 0 || j === M - 1) {
        const numY = axisSize + j * cellSize + cellSize / 2;
        ctx.fillText(String(j + 1), axisSize / 2, numY);
        ctx.fillText(String(j + 1), axisSize + gridWidth + axisSize / 2, numY);
      }
    }
  }

  const keyFontSize = Math.max(6, Math.min(11, Math.floor(cellSize * 0.38)));
  const showKeys = showCellKeys !== undefined ? showCellKeys : cellSize >= 14;
  ctx.font = `bold ${keyFontSize}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const highlightActive = Boolean(
    (persistentHighlight || isHighlighting) && highlightColorKey
  );
  const highlightKeyUpper = highlightColorKey?.toUpperCase() ?? '';
  const highlightStyle = highlightActive
    ? getHighlightRenderStyle(highlightColorKey!, isDarkMode, highlightFade)
    : null;

  const isAccentCell = (row: number, col: number): boolean => {
    if (!highlightActive) return false;
    const cell = dataToDraw[row]?.[col];
    if (!cell || cell.isExternal) return false;
    return (cell.color || '#FFFFFF').toUpperCase() === highlightKeyUpper;
  };

  for (let j = 0; j < M; j++) {
    for (let i = 0; i < N; i++) {
      const cellData = dataToDraw[j]?.[i];
      if (!cellData) continue;

      const drawX = axisSize + i * cellSize;
      const drawY = axisSize + j * cellSize;

      if (cellData.isExternal) {
        ctx.fillStyle = externalBackgroundColor;
      } else {
        ctx.fillStyle = cellData.color || '#FFFFFF';
      }
      ctx.fillRect(drawX, drawY, cellSize, cellSize);
    }
  }

  // 高亮：整幅浅色蒙版把其他颜色变淡，再只把目标色原样重画
  if (highlightStyle) {
    ctx.fillStyle = highlightStyle.dimOverlay;
    ctx.fillRect(axisSize, axisSize, gridWidth, gridHeight);

    for (let j = 0; j < M; j++) {
      for (let i = 0; i < N; i++) {
        if (!isAccentCell(j, i)) continue;
        const cellData = dataToDraw[j]?.[i];
        if (!cellData) continue;
        const drawX = axisSize + i * cellSize;
        const drawY = axisSize + j * cellSize;
        ctx.fillStyle = cellData.color || '#FFFFFF';
        ctx.fillRect(drawX, drawY, cellSize, cellSize);
        ctx.save();
        ctx.globalCompositeOperation = highlightStyle.accentLiftComposite;
        ctx.fillStyle = highlightStyle.accentLift;
        ctx.fillRect(drawX, drawY, cellSize, cellSize);
        ctx.restore();
      }
    }
  }

  for (let j = 0; j < M; j++) {
    for (let i = 0; i < N; i++) {
      const cellData = dataToDraw[j]?.[i];
      if (!cellData) continue;

      const drawX = axisSize + i * cellSize;
      const drawY = axisSize + j * cellSize;
      const isAccent = isAccentCell(j, i);

      if (selectedCells?.has(cellKey(j, i))) {
        ctx.fillStyle = 'rgba(59, 130, 246, 0.38)';
        ctx.fillRect(drawX, drawY, cellSize, cellSize);
        ctx.strokeStyle = 'rgba(37, 99, 235, 0.95)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(drawX + 0.75, drawY + 0.75, cellSize - 1.5, cellSize - 1.5);
      }

      if (showKeys && !cellData.isExternal && cellData.key !== 'ERASE') {
        if (!highlightStyle || isAccent) {
          const displayKey = getDisplayColorKey(cellData.color || '#FFFFFF', selectedColorSystem);
          ctx.fillStyle = getContrastColor(cellData.color || '#FFFFFF');
          ctx.fillText(displayKey, drawX + cellSize / 2, drawY + cellSize / 2);
        }
      }

      if (showGrid) {
        if (highlightStyle) {
          ctx.strokeStyle = isAccent ? highlightStyle.accentGridColor : highlightStyle.mutedGridColor;
        } else {
          ctx.strokeStyle = gridLineColor;
        }
        ctx.lineWidth = 0.5;
        ctx.strokeRect(drawX + 0.5, drawY + 0.5, cellSize, cellSize);
      }
    }
  }

  if (showGrid) {
    ctx.strokeStyle = sectionLineColor;
    ctx.lineWidth = 2;
    for (let i = gridInterval; i < N; i += gridInterval) {
      const x = axisSize + i * cellSize;
      ctx.beginPath();
      ctx.moveTo(x, axisSize);
      ctx.lineTo(x, axisSize + gridHeight);
      ctx.stroke();
    }
    for (let j = gridInterval; j < M; j += gridInterval) {
      const y = axisSize + j * cellSize;
      ctx.beginPath();
      ctx.moveTo(axisSize, y);
      ctx.lineTo(axisSize + gridWidth, y);
      ctx.stroke();
    }
  }

  if (cropRect) {
    const r0 = Math.min(cropRect.startRow, cropRect.endRow);
    const r1 = Math.max(cropRect.startRow, cropRect.endRow);
    const c0 = Math.min(cropRect.startCol, cropRect.endCol);
    const c1 = Math.max(cropRect.startCol, cropRect.endCol);
    const x = axisSize + c0 * cellSize;
    const y = axisSize + r0 * cellSize;
    const w = (c1 - c0 + 1) * cellSize;
    const h = (r1 - r0 + 1) * cellSize;

    // 裁剪框外变暗
    ctx.fillStyle = 'rgba(15, 23, 42, 0.35)';
    ctx.beginPath();
    ctx.rect(axisSize, axisSize, gridWidth, gridHeight);
    ctx.rect(x, y, w, h);
    ctx.fill('evenodd');

    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  }

  if (showGrid) {
    ctx.strokeStyle = isDarkMode ? '#9ca3af' : '#111111';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(axisSize + 0.5, axisSize + 0.5, gridWidth, gridHeight);
  }
}

const PixelatedPreviewCanvas: React.FC<PixelatedPreviewCanvasProps> = ({
  mappedPixelData,
  gridDimensions,
  canvasRef,
  onInteraction,
  highlightColorKey,
  persistentHighlight = false,
  onHighlightComplete,
  selectedColorSystem = 'MARD',
  previewZoom = 1,
  toolMode = 'select',
  selectedCells,
  onSelectCells,
  onSelectionDoubleClick,
  cropRect,
  onCropRectChange,
  onPanBy,
  onPinchZoom,
  gridInterval = 10,
  highlightFade = 0.84,
  showCellKeys,
  showGrid = true,
}) => {
  const [darkModeState, setDarkModeState] = useState<boolean | null>(null);
  const touchStartPosRef = useRef<{ x: number; y: number; pageX: number; pageY: number } | null>(null);
  const touchMovedRef = useRef(false);
  const lastTouchPanRef = useRef<{ x: number; y: number } | null>(null);
  const pinchRef = useRef<{ distance: number } | null>(null);
  const [isHighlighting, setIsHighlighting] = useState(false);
  const isDraggingRef = useRef(false);
  const lastCellRef = useRef<{ row: number; col: number } | null>(null);
  const dragStartRef = useRef<{ row: number; col: number } | null>(null);
  const dragBaseKeysRef = useRef<Set<string>>(new Set());
  const layoutRef = useRef({ cellSize: 16, axisSize: 28 });
  const selectClickRef = useRef<{
    key: string;
    row: number;
    col: number;
    wasSelected: boolean;
    shiftKey: boolean;
    x: number;
    y: number;
  } | null>(null);
  const selectMovedRef = useRef(false);
  const ignoreClickRef = useRef(false);
  const spacePanRef = useRef(false);
  const panRef = useRef<{ x: number; y: number; pointerId: number } | null>(null);

  useEffect(() => {
    const isTypingTarget = (target: EventTarget | null) => {
      const el = target as HTMLElement | null;
      const tag = el?.tagName?.toLowerCase();
      return tag === 'input' || tag === 'textarea' || tag === 'select' || !!el?.isContentEditable;
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || isTypingTarget(event.target)) return;
      spacePanRef.current = true;
      event.preventDefault();
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') spacePanRef.current = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  const baseCellSize = 16;
  const cellSize = Math.max(4, Math.round(baseCellSize * previewZoom));
  const axisSize = Math.max(18, Math.min(36, Math.round(cellSize * 1.4)));
  layoutRef.current = { cellSize, axisSize };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const checkDarkMode = () => {
      const isDark = document.documentElement.classList.contains('dark');
      if (isDark !== darkModeState) setDarkModeState(isDark);
    };
    checkDarkMode();
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, [darkModeState]);

  useEffect(() => {
    if (mappedPixelData && gridDimensions && canvasRef.current && darkModeState !== null) {
      drawPixelatedCanvas(mappedPixelData, canvasRef.current, gridDimensions, {
        highlightColorKey,
        persistentHighlight,
        isHighlighting,
        isDarkMode: darkModeState,
        selectedColorSystem,
        cellSize,
        axisSize,
        gridInterval,
        selectedCells,
        cropRect,
        highlightFade,
        showCellKeys,
        showGrid,
      });
    }
  }, [
    mappedPixelData,
    gridDimensions,
    canvasRef,
    darkModeState,
    highlightColorKey,
    persistentHighlight,
    isHighlighting,
    selectedColorSystem,
    cellSize,
    axisSize,
    gridInterval,
    selectedCells,
    cropRect,
    highlightFade,
    showCellKeys,
    showGrid,
  ]);

  useEffect(() => {
    if (persistentHighlight) {
      setIsHighlighting(Boolean(highlightColorKey));
      return;
    }
    if (highlightColorKey && mappedPixelData && gridDimensions) {
      setIsHighlighting(true);
      const timer = setTimeout(() => {
        setIsHighlighting(false);
        onHighlightComplete?.();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [highlightColorKey, mappedPixelData, gridDimensions, onHighlightComplete, persistentHighlight]);

  const resolveCell = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas || !gridDimensions) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const canvasX = (clientX - rect.left) * scaleX;
    const canvasY = (clientY - rect.top) * scaleY;
    const { cellSize: cs, axisSize: as } = layoutRef.current;
    const col = Math.floor((canvasX - as) / cs);
    const row = Math.floor((canvasY - as) / cs);
    if (col < 0 || row < 0 || col >= gridDimensions.N || row >= gridDimensions.M) return null;
    return { row, col };
  };

  const keysInRect = (a: { row: number; col: number }, b: { row: number; col: number }) => {
    const r0 = Math.min(a.row, b.row);
    const r1 = Math.max(a.row, b.row);
    const c0 = Math.min(a.col, b.col);
    const c1 = Math.max(a.col, b.col);
    const keys: string[] = [];
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        keys.push(cellKey(r, c));
      }
    }
    return keys;
  };

  const selectGesture = toolMode === 'select' && !!onSelectCells;
  const cropGesture = toolMode === 'crop' && !!onCropRectChange;

  const wantsPan = (event: { button: number; altKey: boolean }) =>
    !!onPanBy && (event.button === 1 || event.altKey);

  const beginPan = (x: number, y: number) => {
    panRef.current = { x, y, pointerId: -1 };
    const onUp = () => {
      panRef.current = null;
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mouseup', onUp);
  };

  const finishSelectClick = () => {
    if (!selectGesture || !selectClickRef.current || selectMovedRef.current) {
      selectClickRef.current = null;
      selectMovedRef.current = false;
      return;
    }
    const { key, row, col, wasSelected, shiftKey } = selectClickRef.current;
    const next = new Set(dragBaseKeysRef.current);

    // Shift+点击：加选与该格八连通的同色区域（含对角，桌面）
    if (shiftKey && mappedPixelData) {
      const cell = mappedPixelData[row]?.[col];
      if (cell && !cell.isExternal && cell.key !== TRANSPARENT_KEY) {
        const region = getConnectedRegion(mappedPixelData, row, col, cell.color, 8);
        region.forEach(({ row: r, col: c }) => next.add(cellKey(r, c)));
      } else {
        next.add(key);
      }
    } else if (wasSelected) {
      next.delete(key);
    } else {
      next.add(key);
    }

    onSelectCells?.(Array.from(next), 'set');
    ignoreClickRef.current = true;
    selectClickRef.current = null;
    selectMovedRef.current = false;
  };

  const handleMouseMove = (event: MouseEvent<HTMLCanvasElement>) => {
    if (panRef.current) {
      const dx = event.clientX - panRef.current.x;
      const dy = event.clientY - panRef.current.y;
      panRef.current = { ...panRef.current, x: event.clientX, y: event.clientY };
      onPanBy?.(dx, dy);
      return;
    }

    if (isDraggingRef.current) {
      const cell = resolveCell(event.clientX, event.clientY);

      if (selectClickRef.current) {
        const dx = Math.abs(event.clientX - selectClickRef.current.x);
        const dy = Math.abs(event.clientY - selectClickRef.current.y);
        if (dx > 4 || dy > 4) selectMovedRef.current = true;
      }

      if (!cell) return;

      if (cropGesture && dragStartRef.current && onCropRectChange) {
        onCropRectChange({
          startRow: dragStartRef.current.row,
          startCol: dragStartRef.current.col,
          endRow: cell.row,
          endCol: cell.col,
        });
        return;
      }

      if (selectGesture && dragStartRef.current && selectMovedRef.current) {
        const rectKeys = keysInRect(dragStartRef.current, cell);
        const merged = new Set(dragBaseKeysRef.current);
        rectKeys.forEach((k) => merged.add(k));
        onSelectCells?.(Array.from(merged), 'set');
        return;
      }
    }

    if (!isDraggingRef.current) {
      onInteraction(event.clientX, event.clientY, event.pageX, event.pageY, false);
    }
  };

  const handleMouseLeave = () => {
    if (panRef.current) return;
    finishSelectClick();
    isDraggingRef.current = false;
    lastCellRef.current = null;
    dragStartRef.current = null;
    onInteraction(0, 0, 0, 0, false, true);
  };

  const handleMouseDown = (event: MouseEvent<HTMLCanvasElement>) => {
    // 空格拖动由外层画布用指针捕获处理，避免图纸跟着鼠标移走后拖动中断
    if (spacePanRef.current && event.button === 0) {
      event.preventDefault();
      return;
    }
    if (wantsPan(event)) {
      event.preventDefault();
      beginPan(event.clientX, event.clientY);
      return;
    }
    if (event.button !== 0) return;
    const cell = resolveCell(event.clientX, event.clientY);
    if (!cell) {
      if (onPanBy) {
        event.preventDefault();
        beginPan(event.clientX, event.clientY);
      }
      return;
    }
    if (!selectGesture && !cropGesture) return;

    isDraggingRef.current = true;
    dragStartRef.current = cell;
    lastCellRef.current = cell;
    dragBaseKeysRef.current = new Set(selectedCells || []);
    selectMovedRef.current = false;
    selectClickRef.current = selectGesture
      ? {
          key: cellKey(cell.row, cell.col),
          row: cell.row,
          col: cell.col,
          wasSelected: !!selectedCells?.has(cellKey(cell.row, cell.col)),
          shiftKey: event.shiftKey,
          x: event.clientX,
          y: event.clientY,
        }
      : null;
    event.preventDefault();

    if (cropGesture && onCropRectChange) {
      onCropRectChange({
        startRow: cell.row,
        startCol: cell.col,
        endRow: cell.row,
        endCol: cell.col,
      });
    }
  };

  const handleMouseUp = () => {
    if (panRef.current) {
      panRef.current = null;
      ignoreClickRef.current = true;
      return;
    }
    finishSelectClick();
    isDraggingRef.current = false;
    lastCellRef.current = null;
    dragStartRef.current = null;
  };

  const handleClick = (event: MouseEvent<HTMLCanvasElement>) => {
    if (ignoreClickRef.current) {
      ignoreClickRef.current = false;
      return;
    }
    if (toolMode === 'crop') return;
    if (toolMode === 'select' || toolMode === 'bead') {
      onInteraction(event.clientX, event.clientY, event.pageX, event.pageY, true);
    }
  };

  const handleDoubleClick = (event: MouseEvent<HTMLCanvasElement>) => {
    if (!selectGesture) return;
    event.preventDefault();
    onSelectionDoubleClick?.();
  };

  const handleTouchStart = (event: TouchEvent<HTMLCanvasElement>) => {
    if (event.touches.length >= 2) {
      touchMovedRef.current = true;
      const a = event.touches[0];
      const b = event.touches[1];
      if (a && b) {
        const dx = a.clientX - b.clientX;
        const dy = a.clientY - b.clientY;
        pinchRef.current = { distance: Math.hypot(dx, dy) || 1 };
      }
      lastTouchPanRef.current = null;
      touchStartPosRef.current = null;
      return;
    }

    const touch = event.touches[0];
    if (!touch) return;

    touchStartPosRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      pageX: touch.pageX,
      pageY: touch.pageY,
    };
    lastTouchPanRef.current = { x: touch.clientX, y: touch.clientY };
    touchMovedRef.current = false;
    pinchRef.current = null;

    if (!selectGesture && !cropGesture) return;

    const cell = resolveCell(touch.clientX, touch.clientY);
    if (!cell) return;
    isDraggingRef.current = true;
    dragStartRef.current = cell;
    lastCellRef.current = cell;
    dragBaseKeysRef.current = new Set(selectedCells || []);
    selectMovedRef.current = false;
    selectClickRef.current = selectGesture
      ? {
          key: cellKey(cell.row, cell.col),
          row: cell.row,
          col: cell.col,
          wasSelected: !!selectedCells?.has(cellKey(cell.row, cell.col)),
          shiftKey: false,
          x: touch.clientX,
          y: touch.clientY,
        }
      : null;

    if (cropGesture && onCropRectChange) {
      onCropRectChange({
        startRow: cell.row,
        startCol: cell.col,
        endRow: cell.row,
        endCol: cell.col,
      });
    }
  };

  const handleTouchMove = (event: globalThis.TouchEvent) => {
    if (event.touches.length >= 2) {
      touchMovedRef.current = true;
      const a = event.touches[0];
      const b = event.touches[1];
      if (a && b && (onPinchZoom || onPanBy)) {
        const dx = a.clientX - b.clientX;
        const dy = a.clientY - b.clientY;
        const distance = Math.hypot(dx, dy) || 1;
        const center = { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 };
        if (pinchRef.current && onPinchZoom) {
          const scale = distance / pinchRef.current.distance;
          if (Number.isFinite(scale) && scale > 0) {
            onPinchZoom(scale, center);
          }
        }
        pinchRef.current = { distance };
        event.preventDefault();
      }
      return;
    }

    const touch = event.touches[0];
    if (!touch || !touchStartPosRef.current) return;

    const dxAbs = Math.abs(touch.clientX - touchStartPosRef.current.x);
    const dyAbs = Math.abs(touch.clientY - touchStartPosRef.current.y);
    if (!touchMovedRef.current && (dxAbs > 8 || dyAbs > 8)) {
      touchMovedRef.current = true;
      selectMovedRef.current = true;
      onInteraction(0, 0, 0, 0, false, true);
    }

    // 拼豆 / 轻量编辑选格：触控单指拖动平移画布（不做框选）
    if (
      (toolMode === 'bead' || toolMode === 'select') &&
      onPanBy &&
      touchMovedRef.current &&
      lastTouchPanRef.current
    ) {
      const dx = touch.clientX - lastTouchPanRef.current.x;
      const dy = touch.clientY - lastTouchPanRef.current.y;
      lastTouchPanRef.current = { x: touch.clientX, y: touch.clientY };
      // 取消框选手势，避免松手后误改选区
      selectClickRef.current = null;
      isDraggingRef.current = false;
      onPanBy(dx, dy);
      event.preventDefault();
      return;
    }

    if (!isDraggingRef.current) return;
    const cell = resolveCell(touch.clientX, touch.clientY);
    if (!cell) return;

    if (cropGesture && dragStartRef.current && onCropRectChange) {
      onCropRectChange({
        startRow: dragStartRef.current.row,
        startCol: dragStartRef.current.col,
        endRow: cell.row,
        endCol: cell.col,
      });
      event.preventDefault();
      return;
    }

    if (selectGesture && dragStartRef.current && selectMovedRef.current) {
      const rectKeys = keysInRect(dragStartRef.current, cell);
      const merged = new Set(dragBaseKeysRef.current);
      rectKeys.forEach((k) => merged.add(k));
      onSelectCells?.(Array.from(merged), 'set');
      event.preventDefault();
    }
  };

  // React 的 onTouchMove 默认 passive，无法 preventDefault；改用原生非被动监听
  const handleTouchMoveRef = useRef(handleTouchMove);
  handleTouchMoveRef.current = handleTouchMove;
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const listener = (event: globalThis.TouchEvent) => {
      handleTouchMoveRef.current(event);
    };
    canvas.addEventListener('touchmove', listener, { passive: false });
    return () => canvas.removeEventListener('touchmove', listener);
  }, [canvasRef]);

  const handleTouchEnd = (event: TouchEvent<HTMLCanvasElement>) => {
    if (event.touches.length >= 2) {
      const a = event.touches[0];
      const b = event.touches[1];
      if (a && b) {
        const dx = a.clientX - b.clientX;
        const dy = a.clientY - b.clientY;
        pinchRef.current = { distance: Math.hypot(dx, dy) || 1 };
      }
      return;
    }
    if (event.touches.length === 1) {
      const touch = event.touches[0];
      pinchRef.current = null;
      if (touch) {
        lastTouchPanRef.current = { x: touch.clientX, y: touch.clientY };
        touchStartPosRef.current = {
          x: touch.clientX,
          y: touch.clientY,
          pageX: touch.pageX,
          pageY: touch.pageY,
        };
        touchMovedRef.current = true;
      }
      return;
    }

    if (!touchMovedRef.current) {
      finishSelectClick();
    } else {
      selectClickRef.current = null;
      selectMovedRef.current = false;
    }
    if (
      !touchMovedRef.current &&
      !ignoreClickRef.current &&
      touchStartPosRef.current &&
      (toolMode === 'select' || toolMode === 'bead')
    ) {
      const { x, y, pageX, pageY } = touchStartPosRef.current;
      onInteraction(x, y, pageX, pageY, true);
      // 抑制随后的合成 click，避免点格被触发两次
      ignoreClickRef.current = true;
    }
    isDraggingRef.current = false;
    lastCellRef.current = null;
    dragStartRef.current = null;
    touchStartPosRef.current = null;
    touchMovedRef.current = false;
    lastTouchPanRef.current = null;
    pinchRef.current = null;
  };

  // silence unused
  void lastCellRef;

  return (
    <canvas
      ref={canvasRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      className={`max-w-none h-auto block select-none ${
        toolMode === 'crop' ? 'cursor-crosshair' : 'cursor-cell'
      }`}
      style={{ imageRendering: 'pixelated', touchAction: 'none' }}
    />
  );
};

export default PixelatedPreviewCanvas;
