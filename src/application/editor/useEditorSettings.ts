'use client';

import { useCallback, useEffect, useRef, type ChangeEvent } from 'react';
import { PixelationMode, recountColors, scalePixelGrid } from '../../domain/pixelation';
import type { CreativePresetId } from '../../domain/pixelation';
import { useEditorStore } from './editorStore';
import { useEditorGenerationParams } from './editorSelectors';

type UseEditorSettingsOptions = {
  showToast: (msg: string) => void;
};

const clampGridSize = (value: number) => Math.max(10, Math.min(300, value));
const clampSimilarity = (value: number) => Math.max(0, Math.min(100, value));
const COMMIT_DEBOUNCE_MS = 320;

/** 参数面板：未手改时改动即生成；已手改时仅改参数，需缩放或重新生成 */
export function useEditorSettings({ showToast }: UseEditorSettingsOptions) {
  const {
    granularity,
    setGranularity,
    granularityInput,
    setGranularityInput,
    gridHeight,
    setGridHeight,
    gridHeightInput,
    setGridHeightInput,
    keepAspectRatio,
    setKeepAspectRatio,
    imageAspectRatio,
    similarityThreshold,
    setSimilarityThreshold,
    similarityThresholdInput,
    setSimilarityThresholdInput,
    maxColorCount,
    setMaxColorCount,
    autoRemoveWhiteBg,
    setAutoRemoveWhiteBg,
    pixelationMode,
    setPixelationMode,
    creativePreset,
    ditheringEnabled,
    setDitheringEnabled,
    applyCreativePreset,
    remapTrigger,
    setRemapTrigger,
    setSelectedColor,
  } = useEditorGenerationParams();

  const gridManuallyEdited = useEditorStore((s) => s.gridManuallyEdited);
  const mappedPixelData = useEditorStore((s) => s.mappedPixelData);
  const gridDimensions = useEditorStore((s) => s.gridDimensions);
  const setMappedPixelData = useEditorStore((s) => s.setMappedPixelData);
  const setGridDimensions = useEditorStore((s) => s.setGridDimensions);
  const setColorCounts = useEditorStore((s) => s.setColorCounts);
  const setTotalBeadCount = useEditorStore((s) => s.setTotalBeadCount);
  const clearGridManuallyEdited = useEditorStore((s) => s.clearGridManuallyEdited);
  const setSelectedCells = useEditorStore((s) => s.setSelectedCells);
  const setShowSelectionRecolor = useEditorStore((s) => s.setShowSelectionRecolor);

  const widthTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const similarityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (widthTimerRef.current) clearTimeout(widthTimerRef.current);
      if (heightTimerRef.current) clearTimeout(heightTimerRef.current);
      if (similarityTimerRef.current) clearTimeout(similarityTimerRef.current);
    };
  }, []);

  const triggerRemapIfAllowed = useCallback(() => {
    if (!useEditorStore.getState().gridManuallyEdited) {
      setRemapTrigger((prev) => prev + 1);
      setSelectedColor(null);
    }
  }, [setRemapTrigger, setSelectedColor]);

  const applyGridWidth = useCallback(
    (rawWidth: number, commit = true) => {
      const width = clampGridSize(rawWidth);
      let height = gridHeight;
      if (keepAspectRatio && imageAspectRatio > 0) {
        height = clampGridSize(Math.round(width * imageAspectRatio));
      }
      if (commit) {
        const sizeChanged = width !== granularity || height !== gridHeight;
        setGranularity(width);
        setGridHeight(height);
        // 已手改：只改目标尺寸，不触发从原图重算
        if (sizeChanged && !useEditorStore.getState().gridManuallyEdited) {
          setRemapTrigger((prev) => prev + 1);
          setSelectedColor(null);
        }
      }
      setGranularityInput(width.toString());
      setGridHeightInput(height.toString());
      return { width, height };
    },
    [
      granularity,
      gridHeight,
      keepAspectRatio,
      imageAspectRatio,
      setGranularity,
      setGridHeight,
      setRemapTrigger,
      setSelectedColor,
      setGranularityInput,
      setGridHeightInput,
    ],
  );

  const applyGridHeight = useCallback(
    (rawHeight: number, commit = true) => {
      if (keepAspectRatio) {
        return { width: granularity, height: gridHeight };
      }
      const height = clampGridSize(rawHeight);
      const width = granularity;
      if (commit) {
        const sizeChanged = height !== gridHeight;
        setGranularity(width);
        setGridHeight(height);
        if (sizeChanged && !useEditorStore.getState().gridManuallyEdited) {
          setRemapTrigger((prev) => prev + 1);
          setSelectedColor(null);
        }
      }
      setGranularityInput(width.toString());
      setGridHeightInput(height.toString());
      return { width, height };
    },
    [
      keepAspectRatio,
      granularity,
      gridHeight,
      setGranularity,
      setGridHeight,
      setRemapTrigger,
      setSelectedColor,
      setGranularityInput,
      setGridHeightInput,
    ],
  );

  const commitSimilarity = useCallback(
    (raw: string) => {
      const parsed = parseInt(raw, 10);
      const next = clampSimilarity(Number.isFinite(parsed) ? parsed : 0);
      if (next !== similarityThreshold) {
        setSimilarityThreshold(next);
        if (!useEditorStore.getState().gridManuallyEdited) {
          setRemapTrigger((prev) => prev + 1);
          setSelectedColor(null);
        }
      }
      setSimilarityThresholdInput(next.toString());
    },
    [
      similarityThreshold,
      setSimilarityThreshold,
      setRemapTrigger,
      setSelectedColor,
      setSimilarityThresholdInput,
    ],
  );

  const handleGranularityInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      setGranularityInput(value);
      if (value.trim() === '') return;
      const n = parseInt(value, 10);
      if (!Number.isFinite(n)) return;
      if (widthTimerRef.current) clearTimeout(widthTimerRef.current);
      widthTimerRef.current = setTimeout(() => {
        applyGridWidth(n, true);
      }, COMMIT_DEBOUNCE_MS);
    },
    [setGranularityInput, applyGridWidth],
  );

  const handleGridHeightInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      setGridHeightInput(value);
      if (keepAspectRatio) return;
      if (value.trim() === '') return;
      const n = parseInt(value, 10);
      if (!Number.isFinite(n)) return;
      if (heightTimerRef.current) clearTimeout(heightTimerRef.current);
      heightTimerRef.current = setTimeout(() => {
        applyGridHeight(n, true);
      }, COMMIT_DEBOUNCE_MS);
    },
    [setGridHeightInput, keepAspectRatio, applyGridHeight],
  );

  const handleSimilarityThresholdInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      setSimilarityThresholdInput(value);
      if (value.trim() === '') return;
      const n = parseInt(value, 10);
      if (!Number.isFinite(n)) return;
      if (similarityTimerRef.current) clearTimeout(similarityTimerRef.current);
      similarityTimerRef.current = setTimeout(() => {
        commitSimilarity(value);
      }, COMMIT_DEBOUNCE_MS);
    },
    [setSimilarityThresholdInput, commitSimilarity],
  );

  const flushGridWidth = useCallback(() => {
    if (widthTimerRef.current) {
      clearTimeout(widthTimerRef.current);
      widthTimerRef.current = null;
    }
    applyGridWidth(parseInt(granularityInput, 10) || 10, true);
  }, [applyGridWidth, granularityInput]);

  const flushGridHeight = useCallback(() => {
    if (heightTimerRef.current) {
      clearTimeout(heightTimerRef.current);
      heightTimerRef.current = null;
    }
    if (!keepAspectRatio) {
      applyGridHeight(parseInt(gridHeightInput, 10) || 10, true);
    }
  }, [applyGridHeight, gridHeightInput, keepAspectRatio]);

  const flushSimilarity = useCallback(() => {
    if (similarityTimerRef.current) {
      clearTimeout(similarityTimerRef.current);
      similarityTimerRef.current = null;
    }
    commitSimilarity(similarityThresholdInput);
  }, [commitSimilarity, similarityThresholdInput]);

  const handlePixelationModeChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      const newMode = event.target.value as PixelationMode;
      if (!Object.values(PixelationMode).includes(newMode)) {
        console.warn(`无效的像素化模式: ${newMode}`);
        return;
      }
      setPixelationMode(newMode);
      triggerRemapIfAllowed();
    },
    [setPixelationMode, triggerRemapIfAllowed],
  );

  const handleCreativePresetChange = useCallback(
    (id: CreativePresetId) => {
      applyCreativePreset(id);
      triggerRemapIfAllowed();
    },
    [applyCreativePreset, triggerRemapIfAllowed],
  );

  const handleDitheringChange = useCallback(
    (enabled: boolean) => {
      setDitheringEnabled(enabled);
      triggerRemapIfAllowed();
    },
    [setDitheringEnabled, triggerRemapIfAllowed],
  );

  const scaleGridToInputs = useCallback(() => {
    flushGridWidth();
    flushGridHeight();
    const state = useEditorStore.getState();
    const data = state.mappedPixelData;
    if (!data || !state.gridDimensions) {
      showToast('暂无图纸可缩放');
      return;
    }
    const nextN = clampGridSize(state.granularity);
    const nextM = clampGridSize(state.gridHeight);
    if (nextN === state.gridDimensions.N && nextM === state.gridDimensions.M) {
      showToast('尺寸未变化');
      return;
    }

    const scaled = scalePixelGrid(data, nextN, nextM);
    const { counts, total } = recountColors(scaled);
    setMappedPixelData(scaled);
    setGridDimensions({ N: nextN, M: nextM });
    setGranularity(nextN);
    setGridHeight(nextM);
    setGranularityInput(String(nextN));
    setGridHeightInput(String(nextM));
    setColorCounts(counts);
    setTotalBeadCount(total);
    setSelectedCells(new Set());
    setShowSelectionRecolor(false);
    setSelectedColor(null);
    showToast(`已缩放至 ${nextN}×${nextM}（保留手改）`);
  }, [
    flushGridWidth,
    flushGridHeight,
    showToast,
    setMappedPixelData,
    setGridDimensions,
    setGranularity,
    setGridHeight,
    setGranularityInput,
    setGridHeightInput,
    setColorCounts,
    setTotalBeadCount,
    setSelectedCells,
    setShowSelectionRecolor,
    setSelectedColor,
  ]);

  const regenerateFromOriginal = useCallback(() => {
    flushGridWidth();
    flushGridHeight();
    flushSimilarity();
    if (useEditorStore.getState().gridManuallyEdited) {
      const ok = window.confirm('从原图重新生成会丢弃当前手改（换色、裁剪等），确定继续？');
      if (!ok) return;
    }
    clearGridManuallyEdited();
    setRemapTrigger((prev) => prev + 1);
    setSelectedColor(null);
    showToast('正在从原图重新生成…');
  }, [
    flushGridWidth,
    flushGridHeight,
    flushSimilarity,
    clearGridManuallyEdited,
    setRemapTrigger,
    setSelectedColor,
    showToast,
  ]);

  const sizePending =
    !!gridDimensions &&
    (granularity !== gridDimensions.N || gridHeight !== gridDimensions.M);

  return {
    keepAspectRatio,
    setKeepAspectRatio,
    granularityInput,
    gridHeightInput,
    similarityThresholdInput,
    maxColorCount,
    setMaxColorCount,
    autoRemoveWhiteBg,
    setAutoRemoveWhiteBg,
    pixelationMode,
    creativePreset,
    ditheringEnabled,
    remapTrigger,
    gridManuallyEdited,
    sizePending,
    handleGranularityInputChange,
    handleGridHeightInputChange,
    applyGridWidth: flushGridWidth,
    applyGridHeight: flushGridHeight,
    flushSimilarity,
    handleSimilarityThresholdInputChange,
    handlePixelationModeChange,
    handleCreativePresetChange,
    handleDitheringChange,
    scaleGridToInputs,
    regenerateFromOriginal,
  };
}
