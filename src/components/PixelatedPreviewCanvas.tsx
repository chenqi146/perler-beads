'use client';

import React, { useEffect, useRef, useState, MouseEvent, TouchEvent } from 'react';
import { MappedPixel } from '../utils/pixelation';
import { ColorSystem, getDisplayColorKey } from '../utils/colorSystemUtils';
import { getContrastColor, getHighlightRenderStyle } from '../utils/color';

export type CanvasToolMode = 'select' | 'crop';

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
  /** 拼豆模式：已完成格子 */
  completedCells?: Set<string>;
  /** 拼豆模式：当前推荐区域格子 */
  recommendedCells?: Set<string>;
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
    completedCells?: Set<string>;
    recommendedCells?: Set<string>;
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
    completedCells,
    recommendedCells,
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
  const gridLineColor = isDarkMode ? '#4B5563' : '#DDDDDD';
  const sectionLineColor = isDarkMode ? '#9ca3af' : '#666666';

  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

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

  const keyFontSize = Math.max(6, Math.min(11, Math.floor(cellSize * 0.38)));
  const showKeys = cellSize >= 14;
  ctx.font = `bold ${keyFontSize}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const highlightActive = Boolean(
    (persistentHighlight || isHighlighting) && highlightColorKey
  );
  const highlightKeyUpper = highlightColorKey?.toUpperCase() ?? '';
  const highlightStyle = highlightActive
    ? getHighlightRenderStyle(highlightColorKey!, isDarkMode)
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
      const isAccent = isAccentCell(j, i);

      if (cellData.isExternal) {
        ctx.fillStyle = externalBackgroundColor;
      } else {
        ctx.fillStyle = cellData.color || '#FFFFFF';
      }
      ctx.fillRect(drawX, drawY, cellSize, cellSize);

      if (highlightStyle && isAccent) {
        ctx.save();
        ctx.globalCompositeOperation = highlightStyle.accentLiftComposite;
        ctx.fillStyle = highlightStyle.accentLift;
        ctx.fillRect(drawX, drawY, cellSize, cellSize);
        ctx.restore();
      } else if (highlightStyle && !isAccent) {
        ctx.fillStyle = highlightStyle.dimOverlay;
        ctx.fillRect(drawX, drawY, cellSize, cellSize);
      }

      if (selectedCells?.has(cellKey(j, i))) {
        ctx.fillStyle = 'rgba(59, 130, 246, 0.38)';
        ctx.fillRect(drawX, drawY, cellSize, cellSize);
        ctx.strokeStyle = 'rgba(37, 99, 235, 0.95)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(drawX + 0.75, drawY + 0.75, cellSize - 1.5, cellSize - 1.5);
      }

      if (completedCells?.has(cellKey(j, i)) && !cellData.isExternal) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
        ctx.fillRect(drawX, drawY, cellSize, cellSize);
        ctx.strokeStyle = 'rgba(196, 122, 44, 0.75)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(drawX + cellSize * 0.22, drawY + cellSize * 0.52);
        ctx.lineTo(drawX + cellSize * 0.42, drawY + cellSize * 0.72);
        ctx.lineTo(drawX + cellSize * 0.78, drawY + cellSize * 0.28);
        ctx.stroke();
      }

      if (recommendedCells?.has(cellKey(j, i)) && !cellData.isExternal) {
        ctx.strokeStyle = 'rgba(234, 88, 12, 0.95)';
        ctx.lineWidth = Math.max(2, cellSize * 0.12);
        ctx.strokeRect(drawX + 1, drawY + 1, cellSize - 2, cellSize - 2);
        ctx.fillStyle = 'rgba(251, 146, 60, 0.22)';
        ctx.fillRect(drawX, drawY, cellSize, cellSize);
      }

      if (showKeys && !cellData.isExternal && cellData.key !== 'ERASE') {
        if (!highlightStyle || isAccent) {
          const displayKey = getDisplayColorKey(cellData.color || '#FFFFFF', selectedColorSystem);
          ctx.fillStyle = getContrastColor(cellData.color || '#FFFFFF');
          ctx.fillText(displayKey, drawX + cellSize / 2, drawY + cellSize / 2);
        }
      }

      if (highlightStyle) {
        ctx.strokeStyle = isAccent ? highlightStyle.accentGridColor : highlightStyle.mutedGridColor;
      } else {
        ctx.strokeStyle = gridLineColor;
      }
      ctx.lineWidth = 0.5;
      ctx.strokeRect(drawX + 0.5, drawY + 0.5, cellSize, cellSize);
    }
  }

  // 只描色块外轮廓，避免每格描边像铁丝网
  if (highlightStyle) {
    const lineW = Math.max(1.25, Math.min(2.25, cellSize * 0.11));
    ctx.strokeStyle = highlightStyle.silhouetteStroke;
    ctx.lineWidth = lineW;
    ctx.lineCap = 'square';
    ctx.lineJoin = 'miter';
    ctx.beginPath();

    for (let j = 0; j < M; j++) {
      for (let i = 0; i < N; i++) {
        if (!isAccentCell(j, i)) continue;
        const x = axisSize + i * cellSize;
        const y = axisSize + j * cellSize;
        // 邻格不是目标色 → 画这条边
        if (!isAccentCell(j - 1, i)) {
          ctx.moveTo(x, y);
          ctx.lineTo(x + cellSize, y);
        }
        if (!isAccentCell(j + 1, i)) {
          ctx.moveTo(x, y + cellSize);
          ctx.lineTo(x + cellSize, y + cellSize);
        }
        if (!isAccentCell(j, i - 1)) {
          ctx.moveTo(x, y);
          ctx.lineTo(x, y + cellSize);
        }
        if (!isAccentCell(j, i + 1)) {
          ctx.moveTo(x + cellSize, y);
          ctx.lineTo(x + cellSize, y + cellSize);
        }
      }
    }
    ctx.stroke();
  }

  ctx.strokeStyle = sectionLineColor;
  ctx.lineWidth = 1.25;
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

  ctx.strokeStyle = isDarkMode ? '#9ca3af' : '#111111';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(axisSize + 0.5, axisSize + 0.5, gridWidth, gridHeight);
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
  completedCells,
  recommendedCells,
}) => {
  const [darkModeState, setDarkModeState] = useState<boolean | null>(null);
  const touchStartPosRef = useRef<{ x: number; y: number; pageX: number; pageY: number } | null>(null);
  const touchMovedRef = useRef(false);
  const [isHighlighting, setIsHighlighting] = useState(false);
  const isDraggingRef = useRef(false);
  const lastCellRef = useRef<{ row: number; col: number } | null>(null);
  const dragStartRef = useRef<{ row: number; col: number } | null>(null);
  const dragBaseKeysRef = useRef<Set<string>>(new Set());
  const layoutRef = useRef({ cellSize: 16, axisSize: 28 });
  const selectClickRef = useRef<{ key: string; wasSelected: boolean; x: number; y: number } | null>(null);
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
        gridInterval: 10,
        selectedCells,
        cropRect,
        completedCells,
        recommendedCells,
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
    selectedCells,
    cropRect,
    completedCells,
    recommendedCells,
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
    const { key, wasSelected } = selectClickRef.current;
    const next = new Set(dragBaseKeysRef.current);
    if (wasSelected) next.delete(key);
    else next.add(key);
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
          wasSelected: !!selectedCells?.has(cellKey(cell.row, cell.col)),
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
    if (toolMode === 'select') {
      onInteraction(event.clientX, event.clientY, event.pageX, event.pageY, true);
    }
  };

  const handleDoubleClick = (event: MouseEvent<HTMLCanvasElement>) => {
    if (!selectGesture) return;
    event.preventDefault();
    onSelectionDoubleClick?.();
  };

  const handleTouchStart = (event: TouchEvent<HTMLCanvasElement>) => {
    const touch = event.touches[0];
    if (!touch) return;

    touchStartPosRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      pageX: touch.pageX,
      pageY: touch.pageY,
    };
    touchMovedRef.current = false;

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
          wasSelected: !!selectedCells?.has(cellKey(cell.row, cell.col)),
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

  const handleTouchMove = (event: TouchEvent<HTMLCanvasElement>) => {
    const touch = event.touches[0];
    if (!touch || !touchStartPosRef.current) return;

    const dx = Math.abs(touch.clientX - touchStartPosRef.current.x);
    const dy = Math.abs(touch.clientY - touchStartPosRef.current.y);
    if (!touchMovedRef.current && (dx > 8 || dy > 8)) {
      touchMovedRef.current = true;
      selectMovedRef.current = true;
      onInteraction(0, 0, 0, 0, false, true);
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

  const handleTouchEnd = () => {
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
      toolMode === 'select'
    ) {
      const { x, y, pageX, pageY } = touchStartPosRef.current;
      onInteraction(x, y, pageX, pageY, true);
    }
    isDraggingRef.current = false;
    lastCellRef.current = null;
    dragStartRef.current = null;
    touchStartPosRef.current = null;
    touchMovedRef.current = false;
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
      onTouchMove={handleTouchMove}
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
