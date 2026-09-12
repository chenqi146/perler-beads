'use client';

import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { PixelationMode, type MappedPixel } from '../../domain/pixelation';
import {
  saveProjectDraft,
  loadProjectDraft,
} from '../../infrastructure/storage/projectDraftRepository';
import { useEditorStore } from './editorStore';
import type { DraftPixelateLock } from './usePixelationPipeline';

export type UseProjectDraftOptions = {
  currentPatternId?: string;
  suppressPixelateUntilRef: MutableRefObject<number>;
  showToast?: (msg: string) => void;
};

/** 根据格子数据生成合成原图（草稿无原图时兜底） */
function generateSyntheticImageFromPixelData(
  pixelData: MappedPixel[][],
  dimensions: { N: number; M: number },
): string {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    console.error('无法创建canvas上下文');
    return '';
  }

  const pixelSize = 8;
  canvas.width = dimensions.N * pixelSize;
  canvas.height = dimensions.M * pixelSize;

  pixelData.forEach((row, rowIndex) => {
    row.forEach((cell, colIndex) => {
      if (cell) {
        const color = cell.isExternal ? '#FFFFFF' : cell.color;
        ctx.fillStyle = color;
        ctx.fillRect(colIndex * pixelSize, rowIndex * pixelSize, pixelSize, pixelSize);
      }
    });
  });

  return canvas.toDataURL('image/png');
}

/**
 * 项目草稿：挂载恢复（无 patternId）+ 改动自动保存。
 * patternId 优先于草稿恢复；调用方负责 pattern 水合时写入 draftPixelateLockRef。
 */
export function useProjectDraft({
  currentPatternId,
  suppressPixelateUntilRef,
}: UseProjectDraftOptions) {
  const draftPixelateLockRef = useRef<DraftPixelateLock | null>(null);
  const draftReadyToSaveRef = useRef(false);
  const [draftSaveHint, setDraftSaveHint] = useState<string | null>(null);

  const mappedPixelData = useEditorStore((s) => s.mappedPixelData);
  const setMappedPixelData = useEditorStore((s) => s.setMappedPixelData);
  const gridDimensions = useEditorStore((s) => s.gridDimensions);
  const setGridDimensions = useEditorStore((s) => s.setGridDimensions);
  const colorCounts = useEditorStore((s) => s.colorCounts);
  const setColorCounts = useEditorStore((s) => s.setColorCounts);
  const totalBeadCount = useEditorStore((s) => s.totalBeadCount);
  const setTotalBeadCount = useEditorStore((s) => s.setTotalBeadCount);
  const originalImageSrc = useEditorStore((s) => s.originalImageSrc);
  const setOriginalImageSrc = useEditorStore((s) => s.setOriginalImageSrc);
  const granularity = useEditorStore((s) => s.granularity);
  const setGranularity = useEditorStore((s) => s.setGranularity);
  const setGranularityInput = useEditorStore((s) => s.setGranularityInput);
  const gridHeight = useEditorStore((s) => s.gridHeight);
  const setGridHeight = useEditorStore((s) => s.setGridHeight);
  const setGridHeightInput = useEditorStore((s) => s.setGridHeightInput);
  const similarityThreshold = useEditorStore((s) => s.similarityThreshold);
  const setSimilarityThreshold = useEditorStore((s) => s.setSimilarityThreshold);
  const setSimilarityThresholdInput = useEditorStore((s) => s.setSimilarityThresholdInput);
  const maxColorCount = useEditorStore((s) => s.maxColorCount);
  const setMaxColorCount = useEditorStore((s) => s.setMaxColorCount);
  const autoRemoveWhiteBg = useEditorStore((s) => s.autoRemoveWhiteBg);
  const setAutoRemoveWhiteBg = useEditorStore((s) => s.setAutoRemoveWhiteBg);
  const pixelationMode = useEditorStore((s) => s.pixelationMode);
  const setPixelationMode = useEditorStore((s) => s.setPixelationMode);
  const selectedColorSystem = useEditorStore((s) => s.selectedColorSystem);
  const setSelectedColorSystem = useEditorStore((s) => s.setSelectedColorSystem);
  const excludedColorKeys = useEditorStore((s) => s.excludedColorKeys);
  const setExcludedColorKeys = useEditorStore((s) => s.setExcludedColorKeys);
  const initialGridColorKeys = useEditorStore((s) => s.initialGridColorKeys);
  const setInitialGridColorKeys = useEditorStore((s) => s.setInitialGridColorKeys);

  // 启动时恢复上次图纸草稿（有 patternId 时跳过，由 pattern 水合优先）
  useEffect(() => {
    if (currentPatternId) return;
    const draft = loadProjectDraft();
    if (!draft?.mappedPixelData?.length || !draft.gridDimensions) {
      draftReadyToSaveRef.current = true;
      return;
    }

    const g = draft.granularity || draft.gridDimensions.N;
    const h = draft.gridHeight || draft.gridDimensions.M;
    const sim = draft.similarityThreshold ?? 0;
    const mode =
      draft.pixelationMode === PixelationMode.Average || draft.pixelationMode === 'average'
        ? PixelationMode.Average
        : PixelationMode.Dominant;

    draftPixelateLockRef.current = {
      locked: true,
      granularity: g,
      gridHeight: h,
      similarityThreshold: sim,
      maxColorCount: draft.maxColorCount ?? 0,
      autoRemoveWhiteBg: !!draft.autoRemoveWhiteBg,
      pixelationMode: mode,
      remapTrigger: 0,
    };
    suppressPixelateUntilRef.current = Date.now() + 1500;

    setMappedPixelData(draft.mappedPixelData);
    setGridDimensions(draft.gridDimensions);
    setColorCounts(draft.colorCounts);
    setTotalBeadCount(draft.totalBeadCount || 0);
    setGranularity(g);
    setGranularityInput(String(g));
    setGridHeight(h);
    setGridHeightInput(String(h));
    setSimilarityThreshold(sim);
    setSimilarityThresholdInput(String(sim));
    setMaxColorCount(draft.maxColorCount ?? 0);
    setAutoRemoveWhiteBg(!!draft.autoRemoveWhiteBg);
    setPixelationMode(mode);
    if (
      draft.selectedColorSystem === 'MARD' ||
      draft.selectedColorSystem === 'COCO' ||
      draft.selectedColorSystem === '漫漫' ||
      draft.selectedColorSystem === '盼盼' ||
      draft.selectedColorSystem === '咪小窝'
    ) {
      setSelectedColorSystem(draft.selectedColorSystem);
    }
    setExcludedColorKeys(new Set(draft.excludedColorKeys || []));
    setInitialGridColorKeys(new Set(draft.initialGridColorKeys || Object.keys(draft.colorCounts || {})));

    const src =
      draft.originalImageSrc ||
      generateSyntheticImageFromPixelData(draft.mappedPixelData, draft.gridDimensions);
    setOriginalImageSrc(src);

    setDraftSaveHint('已恢复上次图纸');
    const t = window.setTimeout(() => setDraftSaveHint(null), 2500);
    draftReadyToSaveRef.current = true;
    return () => window.clearTimeout(t);
  }, [currentPatternId, suppressPixelateUntilRef]);

  // 图纸改动自动保存到浏览器
  useEffect(() => {
    if (!draftReadyToSaveRef.current) return;
    if (!mappedPixelData || !gridDimensions) return;

    const timer = window.setTimeout(() => {
      const result = saveProjectDraft({
        version: 1,
        savedAt: Date.now(),
        mappedPixelData,
        gridDimensions,
        colorCounts,
        totalBeadCount,
        originalImageSrc,
        granularity,
        gridHeight,
        similarityThreshold,
        maxColorCount,
        autoRemoveWhiteBg,
        pixelationMode,
        selectedColorSystem,
        excludedColorKeys: Array.from(excludedColorKeys),
        initialGridColorKeys: Array.from(initialGridColorKeys),
      });
      if (!result.ok) {
        setDraftSaveHint(result.reason);
        window.setTimeout(() => setDraftSaveHint(null), 3000);
      }
    }, 500);

    return () => window.clearTimeout(timer);
  }, [
    mappedPixelData,
    gridDimensions,
    colorCounts,
    totalBeadCount,
    originalImageSrc,
    granularity,
    gridHeight,
    similarityThreshold,
    maxColorCount,
    autoRemoveWhiteBg,
    pixelationMode,
    selectedColorSystem,
    excludedColorKeys,
    initialGridColorKeys,
  ]);

  return {
    draftPixelateLockRef,
    draftReadyToSaveRef,
    draftSaveHint,
  };
}
