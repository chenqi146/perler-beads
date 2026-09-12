'use client';

import { useCallback, useEffect, type ChangeEvent } from 'react';
import { PixelationMode } from '../../utils/pixelation';
import { useEditorGenerationParams } from './editorSelectors';

type UseEditorSettingsOptions = {
  showToast: (msg: string) => void;
};

const clampGridSize = (value: number) => Math.max(10, Math.min(300, value));

/** 参数面板：输入同步、网格/相似度确认、像素化模式切换 */
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
    remapTrigger,
    setRemapTrigger,
    setSelectedColor,
  } = useEditorGenerationParams();

  // 当状态变化时同步更新输入框的值
  useEffect(() => {
    setGranularityInput(granularity.toString());
    setGridHeightInput(gridHeight.toString());
    setSimilarityThresholdInput(similarityThreshold.toString());
  }, [
    granularity,
    gridHeight,
    similarityThreshold,
    setGranularityInput,
    setGridHeightInput,
    setSimilarityThresholdInput,
  ]);

  const handleGranularityInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setGranularityInput(event.target.value);
    },
    [setGranularityInput],
  );

  const handleGridHeightInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setGridHeightInput(event.target.value);
    },
    [setGridHeightInput],
  );

  const applyGridWidth = useCallback(
    (rawWidth: number, commit = true) => {
      const width = clampGridSize(rawWidth);
      let height = gridHeight;
      if (keepAspectRatio && imageAspectRatio > 0) {
        height = clampGridSize(Math.round(width * imageAspectRatio));
      }
      if (commit) {
        setGranularity(width);
        setGridHeight(height);
        setRemapTrigger((prev) => prev + 1);
        setSelectedColor(null);
      }
      setGranularityInput(width.toString());
      setGridHeightInput(height.toString());
      return { width, height };
    },
    [
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
      // 保持比例时高度是派生值，不能再反向覆盖用户刚提交的宽度。
      if (keepAspectRatio) {
        return { width: granularity, height: gridHeight };
      }
      const height = clampGridSize(rawHeight);
      let width = granularity;
      if (keepAspectRatio && imageAspectRatio > 0) {
        width = clampGridSize(Math.round(height / imageAspectRatio));
      }
      if (commit) {
        setGranularity(width);
        setGridHeight(height);
        setRemapTrigger((prev) => prev + 1);
        setSelectedColor(null);
      }
      setGranularityInput(width.toString());
      setGridHeightInput(height.toString());
      return { width, height };
    },
    [
      keepAspectRatio,
      granularity,
      gridHeight,
      imageAspectRatio,
      setGranularity,
      setGridHeight,
      setRemapTrigger,
      setSelectedColor,
      setGranularityInput,
      setGridHeightInput,
    ],
  );

  const handleSimilarityThresholdInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setSimilarityThresholdInput(event.target.value);
    },
    [setSimilarityThresholdInput],
  );

  const handleConfirmParameters = useCallback(() => {
    const width = clampGridSize(parseInt(granularityInput, 10) || 10);
    const height = keepAspectRatio
      ? clampGridSize(Math.round(width * (imageAspectRatio || 1)))
      : clampGridSize(parseInt(gridHeightInput, 10) || 10);

    const minSimilarity = 0;
    const maxSimilarity = 100;
    let newSimilarity = parseInt(similarityThresholdInput, 10);
    if (isNaN(newSimilarity) || newSimilarity < minSimilarity) newSimilarity = minSimilarity;
    else if (newSimilarity > maxSimilarity) newSimilarity = maxSimilarity;

    const sizeChanged = width !== granularity || height !== gridHeight;
    const similarityChanged = newSimilarity !== similarityThreshold;

    if (sizeChanged) {
      setGranularity(width);
      setGridHeight(height);
    }
    if (similarityChanged) {
      setSimilarityThreshold(newSimilarity);
    }

    if (sizeChanged || similarityChanged) {
      setRemapTrigger((prev) => prev + 1);
      setSelectedColor(null);
    }

    setGranularityInput(width.toString());
    setGridHeightInput(height.toString());
    setSimilarityThresholdInput(newSimilarity.toString());
    showToast(`已应用 ${width} × ${height} 网格`);
  }, [
    granularityInput,
    keepAspectRatio,
    imageAspectRatio,
    gridHeightInput,
    similarityThresholdInput,
    granularity,
    gridHeight,
    similarityThreshold,
    setGranularity,
    setGridHeight,
    setSimilarityThreshold,
    setRemapTrigger,
    setSelectedColor,
    setGranularityInput,
    setGridHeightInput,
    setSimilarityThresholdInput,
    showToast,
  ]);

  const handlePixelationModeChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      const newMode = event.target.value as PixelationMode;
      if (Object.values(PixelationMode).includes(newMode)) {
        setPixelationMode(newMode);
        setRemapTrigger((prev) => prev + 1);
        setSelectedColor(null);
      } else {
        console.warn(`无效的像素化模式: ${newMode}`);
      }
    },
    [setPixelationMode, setRemapTrigger, setSelectedColor],
  );

  return {
    // 参数面板所需状态
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
    remapTrigger,
    // 处理器
    handleGranularityInputChange,
    handleGridHeightInputChange,
    applyGridWidth,
    applyGridHeight,
    handleSimilarityThresholdInputChange,
    handleConfirmParameters,
    handlePixelationModeChange,
  };
}
