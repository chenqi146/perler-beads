'use client';

import { useShallow } from 'zustand/react/shallow';
import { useEditorStore } from './editorStore';
import { useEditorUiStore } from './editorUiStore';

/** 图纸文档数据：像素网格、尺寸、色数统计、原图 */
export function useEditorDocument() {
  return useEditorStore(
    useShallow((s) => ({
      mappedPixelData: s.mappedPixelData,
      gridDimensions: s.gridDimensions,
      colorCounts: s.colorCounts,
      totalBeadCount: s.totalBeadCount,
      originalImageSrc: s.originalImageSrc,
      preAiImageSrc: s.preAiImageSrc,
    })),
  );
}

/** 像素化生成参数与输入框状态 */
export function useEditorGenerationParams() {
  return useEditorStore(
    useShallow((s) => ({
      granularity: s.granularity,
      setGranularity: s.setGranularity,
      granularityInput: s.granularityInput,
      setGranularityInput: s.setGranularityInput,
      gridHeight: s.gridHeight,
      setGridHeight: s.setGridHeight,
      gridHeightInput: s.gridHeightInput,
      setGridHeightInput: s.setGridHeightInput,
      keepAspectRatio: s.keepAspectRatio,
      setKeepAspectRatio: s.setKeepAspectRatio,
      imageAspectRatio: s.imageAspectRatio,
      similarityThreshold: s.similarityThreshold,
      setSimilarityThreshold: s.setSimilarityThreshold,
      similarityThresholdInput: s.similarityThresholdInput,
      setSimilarityThresholdInput: s.setSimilarityThresholdInput,
      maxColorCount: s.maxColorCount,
      setMaxColorCount: s.setMaxColorCount,
      autoRemoveWhiteBg: s.autoRemoveWhiteBg,
      setAutoRemoveWhiteBg: s.setAutoRemoveWhiteBg,
      pixelationMode: s.pixelationMode,
      setPixelationMode: s.setPixelationMode,
      creativePreset: s.creativePreset,
      ditheringEnabled: s.ditheringEnabled,
      setDitheringEnabled: s.setDitheringEnabled,
      applyCreativePreset: s.applyCreativePreset,
      remapTrigger: s.remapTrigger,
      setRemapTrigger: s.setRemapTrigger,
      setSelectedColor: s.setSelectedColor,
    })),
  );
}

/** 色板 / 色号体系 / 自定义色板勾选 */
export function useEditorPaletteState() {
  return useEditorStore(
    useShallow((s) => ({
      selectedColorSystem: s.selectedColorSystem,
      setSelectedColorSystem: s.setSelectedColorSystem,
      activeBeadPalette: s.activeBeadPalette,
      setActiveBeadPalette: s.setActiveBeadPalette,
      customPaletteSelections: s.customPaletteSelections,
      setCustomPaletteSelections: s.setCustomPaletteSelections,
    })),
  );
}

/** 画布工具：选择、裁剪、框选改色 */
export function useEditorToolState() {
  return useEditorStore(
    useShallow((s) => ({
      canvasToolMode: s.canvasToolMode,
      setCanvasToolMode: s.setCanvasToolMode,
      selectedCells: s.selectedCells,
      cropRect: s.cropRect,
      setCropRect: s.setCropRect,
      showSelectionRecolor: s.showSelectionRecolor,
      setShowSelectionRecolor: s.setShowSelectionRecolor,
    })),
  );
}

/** 视口：缩放、平移、高亮（editorUiStore） */
export function useEditorUiViewport() {
  return useEditorUiStore(
    useShallow((s) => ({
      previewZoom: s.previewZoom,
      setPreviewZoom: s.setPreviewZoom,
      canvasOffset: s.canvasOffset,
      setCanvasOffset: s.setCanvasOffset,
      panBy: s.panBy,
      highlightColorKey: s.highlightColorKey,
    })),
  );
}
