'use client';

import { useCallback, type MutableRefObject } from 'react';
import { cellKey } from '../../components/PixelatedPreviewCanvas';
import {
  recountColors,
  cropPixelGrid,
  autoCropPixelGrid,
  TRANSPARENT_KEY,
  transparentColorData,
} from '../../domain/pixelation';
import { useEditorStore } from './editorStore';
import { useEditorUiStore } from './editorUiStore';

export type UseEditorCanvasToolsOptions = {
  saveEditSnapshot: () => void;
  suppressPixelateUntilRef: MutableRefObject<number>;
};

/** 画布选区 / 改色 / 裁剪 / 单格上色 */
export function useEditorCanvasTools({
  saveEditSnapshot,
  suppressPixelateUntilRef,
}: UseEditorCanvasToolsOptions) {
  const mappedPixelData = useEditorStore((s) => s.mappedPixelData);
  const setMappedPixelData = useEditorStore((s) => s.setMappedPixelData);
  const gridDimensions = useEditorStore((s) => s.gridDimensions);
  const setGridDimensions = useEditorStore((s) => s.setGridDimensions);
  const colorCounts = useEditorStore((s) => s.colorCounts);
  const setColorCounts = useEditorStore((s) => s.setColorCounts);
  const totalBeadCount = useEditorStore((s) => s.totalBeadCount);
  const setTotalBeadCount = useEditorStore((s) => s.setTotalBeadCount);
  const setGranularity = useEditorStore((s) => s.setGranularity);
  const setGranularityInput = useEditorStore((s) => s.setGranularityInput);
  const setGridHeight = useEditorStore((s) => s.setGridHeight);
  const setGridHeightInput = useEditorStore((s) => s.setGridHeightInput);
  const setInitialGridColorKeys = useEditorStore((s) => s.setInitialGridColorKeys);
  const selectedColor = useEditorStore((s) => s.selectedColor);
  const setSelectedColor = useEditorStore((s) => s.setSelectedColor);
  const selectedCells = useEditorStore((s) => s.selectedCells);
  const setSelectedCells = useEditorStore((s) => s.setSelectedCells);
  const cropRect = useEditorStore((s) => s.cropRect);
  const setCropRect = useEditorStore((s) => s.setCropRect);
  const setShowSelectionRecolor = useEditorStore((s) => s.setShowSelectionRecolor);
  const setCanvasToolMode = useEditorStore((s) => s.setCanvasToolMode);

  const setHighlightColorKey = useEditorUiStore((s) => s.setHighlightColorKey);

  const handleSelectCells = useCallback((keys: string[], mode: 'add' | 'toggle' | 'set') => {
    setSelectedCells((prev) => {
      if (mode === 'set') return new Set(keys);
      const next = new Set(prev);
      if (mode === 'toggle') {
        keys.forEach((k) => {
          if (next.has(k)) next.delete(k);
          else next.add(k);
        });
      } else {
        keys.forEach((k) => next.add(k));
      }
      return next;
    });
    // 选中格子后立即显示悬浮调色板
    setShowSelectionRecolor(keys.length > 0 || mode !== 'set');
  }, [setSelectedCells, setShowSelectionRecolor]);

  const handleClearCellSelection = useCallback(() => {
    setSelectedCells(new Set());
    setShowSelectionRecolor(false);
    setHighlightColorKey(null);
  }, [setSelectedCells, setShowSelectionRecolor, setHighlightColorKey]);

  const handleApplyColorToSelection = useCallback((color: { key: string; color: string }) => {
    if (!mappedPixelData || !gridDimensions || selectedCells.size === 0) return;

    saveEditSnapshot();
    const nextExternal = color.key === TRANSPARENT_KEY;
    const newPixelData = mappedPixelData.map((rowData, r) =>
      rowData.map((pixel, c) => {
        if (!selectedCells.has(cellKey(r, c))) return pixel;
        return nextExternal
          ? { ...transparentColorData }
          : { key: color.key, color: color.color, isExternal: false };
      })
    );

    setMappedPixelData(newPixelData);
    const { counts, total } = recountColors(newPixelData);
    setColorCounts(counts);
    setTotalBeadCount(total);
    setSelectedColor(null);
    // 改色/擦除完成后清除选中
    setSelectedCells(new Set());
    setShowSelectionRecolor(false);
  }, [
    mappedPixelData,
    gridDimensions,
    selectedCells,
    saveEditSnapshot,
    setMappedPixelData,
    setColorCounts,
    setTotalBeadCount,
    setSelectedColor,
    setSelectedCells,
    setShowSelectionRecolor,
  ]);

  const handleOpenSelectionRecolor = useCallback(() => {
    if (selectedCells.size > 0) {
      setShowSelectionRecolor(true);
    }
  }, [selectedCells.size, setShowSelectionRecolor]);

  /** 点击右侧色号：选中图纸上该色号的全部格子 */
  const handleSelectAllByColor = useCallback((hexKey: string) => {
    if (!mappedPixelData || !gridDimensions) return;
    const target = hexKey.toUpperCase();
    const keys: string[] = [];
    for (let r = 0; r < gridDimensions.M; r++) {
      for (let c = 0; c < gridDimensions.N; c++) {
        const cell = mappedPixelData[r]?.[c];
        if (cell && !cell.isExternal && cell.key !== TRANSPARENT_KEY && cell.color?.toUpperCase() === target) {
          keys.push(cellKey(r, c));
        }
      }
    }
    const alreadySelected = keys.length > 0 && keys.every((k) => selectedCells.has(k)) && selectedCells.size === keys.length;
    if (alreadySelected) {
      handleClearCellSelection();
      return;
    }
    setSelectedCells(new Set(keys));
    setShowSelectionRecolor(keys.length > 0);
    setCanvasToolMode('select');
    setCropRect(null);
    setHighlightColorKey(hexKey);
  }, [
    mappedPixelData,
    gridDimensions,
    selectedCells,
    handleClearCellSelection,
    setSelectedCells,
    setShowSelectionRecolor,
    setCanvasToolMode,
    setCropRect,
    setHighlightColorKey,
  ]);

  // 裁剪只切格子数据；短暂抑制整图重像素化（避免变成「缩小」）
  const applyCropBounds = useCallback((bounds: { minRow: number; maxRow: number; minCol: number; maxCol: number }) => {
    if (!mappedPixelData) return;
    saveEditSnapshot();
    const cropped = cropPixelGrid(mappedPixelData, bounds);
    const N = bounds.maxCol - bounds.minCol + 1;
    const M = bounds.maxRow - bounds.minRow + 1;

    // 切当前图纸格子，不同时按新尺寸重跑整张原图
    suppressPixelateUntilRef.current = Date.now() + 300;
    setMappedPixelData(cropped);
    setGridDimensions({ N, M });
    setGranularity(N);
    setGridHeight(M);
    setGranularityInput(String(N));
    setGridHeightInput(String(M));
    const { counts, total } = recountColors(cropped);
    setColorCounts(counts);
    setTotalBeadCount(total);
    setInitialGridColorKeys(new Set(Object.keys(counts)));
    setCropRect(null);
    setCanvasToolMode('select');
    handleClearCellSelection();
  }, [
    mappedPixelData,
    saveEditSnapshot,
    handleClearCellSelection,
    suppressPixelateUntilRef,
    setMappedPixelData,
    setGridDimensions,
    setGranularity,
    setGridHeight,
    setGranularityInput,
    setGridHeightInput,
    setColorCounts,
    setTotalBeadCount,
    setInitialGridColorKeys,
    setCropRect,
    setCanvasToolMode,
  ]);

  const handleConfirmCrop = useCallback(() => {
    if (!cropRect || !mappedPixelData) return;
    const bounds = {
      minRow: Math.min(cropRect.startRow, cropRect.endRow),
      maxRow: Math.max(cropRect.startRow, cropRect.endRow),
      minCol: Math.min(cropRect.startCol, cropRect.endCol),
      maxCol: Math.max(cropRect.startCol, cropRect.endCol),
    };
    applyCropBounds(bounds);
  }, [cropRect, mappedPixelData, applyCropBounds]);

  const handleAutoCrop = useCallback(() => {
    if (!mappedPixelData) return;
    const result = autoCropPixelGrid(mappedPixelData);
    if (!result) {
      alert('当前图纸没有可裁掉的空白边缘');
      return;
    }
    applyCropBounds(result.bounds);
  }, [mappedPixelData, applyCropBounds]);

  const handlePaintCell = useCallback((row: number, col: number) => {
    if (!mappedPixelData || !gridDimensions || !selectedColor) return;
    if (row < 0 || col < 0 || row >= gridDimensions.M || col >= gridDimensions.N) return;

    const oldPixel = mappedPixelData[row][col];
    if (!oldPixel) return;

    const nextKey = selectedColor.key;
    const nextColor = selectedColor.color;
    const nextExternal = nextKey === TRANSPARENT_KEY;

    if (
      oldPixel.key === nextKey &&
      Boolean(oldPixel.isExternal) === nextExternal
    ) {
      return;
    }

    const newPixelData = mappedPixelData.map((rowData, r) =>
      rowData.map((pixel, c) => {
        if (r === row && c === col) {
          return nextExternal
            ? { ...transparentColorData }
            : { key: nextKey, color: nextColor, isExternal: false };
        }
        return pixel;
      })
    );

    saveEditSnapshot();
    setMappedPixelData(newPixelData);

    if (colorCounts) {
      const newColorCounts = { ...colorCounts };
      let newTotal = totalBeadCount;
      const oldHex = oldPixel.color?.toUpperCase();
      const wasCounted = !oldPixel.isExternal && oldPixel.key !== TRANSPARENT_KEY;

      if (wasCounted && oldHex && newColorCounts[oldHex]) {
        newColorCounts[oldHex].count--;
        if (newColorCounts[oldHex].count <= 0) delete newColorCounts[oldHex];
        newTotal--;
      }

      if (!nextExternal) {
        const newHex = nextColor.toUpperCase();
        if (newColorCounts[newHex]) {
          newColorCounts[newHex].count++;
        } else {
          newColorCounts[newHex] = { count: 1, color: nextColor };
        }
        newTotal++;
      }

      setColorCounts(newColorCounts);
      setTotalBeadCount(newTotal);
    }
  }, [
    mappedPixelData,
    gridDimensions,
    selectedColor,
    colorCounts,
    totalBeadCount,
    saveEditSnapshot,
    setMappedPixelData,
    setColorCounts,
    setTotalBeadCount,
  ]);

  return {
    handleSelectCells,
    handleClearCellSelection,
    handleApplyColorToSelection,
    handleOpenSelectionRecolor,
    handleSelectAllByColor,
    applyCropBounds,
    handleConfirmCrop,
    handleAutoCrop,
    handlePaintCell,
  };
}
