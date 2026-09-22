'use client';

import { useCallback, useEffect, useState, type MutableRefObject, type RefObject } from 'react';
import {
  PixelationMode,
  calculatePixelGrid,
  colorDistance,
  TRANSPARENT_KEY,
  limitColorCount,
  removeEdgeBackground,
  recountColors,
  cleanupPixelGrid,
  mergeRareColors,
  isSmallPixelGrid,
  removeIsolatedNoise,
  type RgbColor,
  type PaletteColor,
  type MappedPixel,
} from '../../domain/pixelation';
import { useEditorStore } from './editorStore';

export type DraftPixelateLock = {
  locked: boolean;
  granularity: number;
  gridHeight: number;
  similarityThreshold: number;
  maxColorCount: number;
  autoRemoveWhiteBg: boolean;
  pixelationMode: string;
  ditheringEnabled: boolean;
  imageContrast: number;
  imageSaturation: number;
  remapTrigger: number;
};

export type UsePixelationPipelineOptions = {
  originalCanvasRef: RefObject<HTMLCanvasElement | null>;
  pixelatedCanvasRef: RefObject<HTMLCanvasElement | null>;
  draftPixelateLockRef: MutableRefObject<DraftPixelateLock | null>;
  suppressPixelateUntilRef: MutableRefObject<number>;
  showToast: (msg: string) => void;
  clearEditHistory: () => void;
};

/**
 * 图像 → 像素网格管线：pixelateImage、参数变更重跑、预处理确认/取消。
 * 算法行为与原先 page.tsx 内联实现保持一致。
 */
export function usePixelationPipeline({
  originalCanvasRef,
  pixelatedCanvasRef,
  draftPixelateLockRef,
  suppressPixelateUntilRef,
  showToast,
  clearEditHistory,
}: UsePixelationPipelineOptions) {
  const originalImageSrc = useEditorStore((s) => s.originalImageSrc);
  const setOriginalImageSrc = useEditorStore((s) => s.setOriginalImageSrc);
  const preAiImageSrc = useEditorStore((s) => s.preAiImageSrc);
  const setPreAiImageSrc = useEditorStore((s) => s.setPreAiImageSrc);

  const granularity = useEditorStore((s) => s.granularity);
  const setGranularity = useEditorStore((s) => s.setGranularity);
  const setGranularityInput = useEditorStore((s) => s.setGranularityInput);
  const gridHeight = useEditorStore((s) => s.gridHeight);
  const setGridHeight = useEditorStore((s) => s.setGridHeight);
  const setGridHeightInput = useEditorStore((s) => s.setGridHeightInput);
  const setImageAspectRatio = useEditorStore((s) => s.setImageAspectRatio);
  const similarityThreshold = useEditorStore((s) => s.similarityThreshold);
  const maxColorCount = useEditorStore((s) => s.maxColorCount);
  const autoRemoveWhiteBg = useEditorStore((s) => s.autoRemoveWhiteBg);
  const setAutoRemoveWhiteBg = useEditorStore((s) => s.setAutoRemoveWhiteBg);
  const pixelationMode = useEditorStore((s) => s.pixelationMode);
  const ditheringEnabled = useEditorStore((s) => s.ditheringEnabled);
  const imageContrast = useEditorStore((s) => s.imageContrast);
  const imageSaturation = useEditorStore((s) => s.imageSaturation);
  const remapTrigger = useEditorStore((s) => s.remapTrigger);
  const gridManuallyEdited = useEditorStore((s) => s.gridManuallyEdited);
  const clearGridManuallyEdited = useEditorStore((s) => s.clearGridManuallyEdited);
  const setRemapTrigger = useEditorStore((s) => s.setRemapTrigger);

  const activeBeadPalette = useEditorStore((s) => s.activeBeadPalette);
  const customPaletteSelections = useEditorStore((s) => s.customPaletteSelections);

  const setMappedPixelData = useEditorStore((s) => s.setMappedPixelData);
  const setGridDimensions = useEditorStore((s) => s.setGridDimensions);
  const setColorCounts = useEditorStore((s) => s.setColorCounts);
  const setTotalBeadCount = useEditorStore((s) => s.setTotalBeadCount);
  const setSelectedColor = useEditorStore((s) => s.setSelectedColor);
  const setSelectedCells = useEditorStore((s) => s.setSelectedCells);
  const setShowSelectionRecolor = useEditorStore((s) => s.setShowSelectionRecolor);
  const setCropRect = useEditorStore((s) => s.setCropRect);
  const setCanvasToolMode = useEditorStore((s) => s.setCanvasToolMode);
  const setBgRemovalSnapshot = useEditorStore((s) => s.setBgRemovalSnapshot);

  // 上传后预处理弹窗（裁剪 + 可选 AI 抠图）— 状态留在管线内，page 只消费返回值
  const [pendingPrepImageSrc, setPendingPrepImageSrc] = useState<string | null>(null);
  const [isImagePrepOpen, setIsImagePrepOpen] = useState(false);

  const pixelateImage = useCallback(
    (
      imageSrc: string,
      gridW: number,
      gridH: number,
      threshold: number,
      currentPalette: PaletteColor[],
      mode: PixelationMode,
      colorLimit: number,
      doAutoRemoveBg: boolean,
      enableDithering: boolean,
      contrast: number,
      saturation: number,
    ) => {
      console.log(
        `Attempting to pixelate with size: ${gridW}x${gridH}, threshold: ${threshold}, mode: ${mode}, colorLimit: ${colorLimit}, dithering: ${enableDithering}, contrast: ${contrast}, saturation: ${saturation}`,
      );
      const originalCanvas = originalCanvasRef.current;
      const pixelatedCanvas = pixelatedCanvasRef.current;

      if (!originalCanvas || !pixelatedCanvas) {
        console.error('Canvas ref(s) not available.');
        return;
      }
      const originalCtx = originalCanvas.getContext('2d', { willReadFrequently: true });
      const pixelatedCtx = pixelatedCanvas.getContext('2d');
      if (!originalCtx || !pixelatedCtx) {
        console.error('Canvas context(s) not found.');
        return;
      }
      console.log('Canvas contexts obtained.');

      if (currentPalette.length === 0) {
        console.error('Cannot pixelate: The selected color palette is empty.');
        alert('错误：当前可用颜色板为空，无法处理图像。请在色板管理中勾选颜色。');
        pixelatedCtx.clearRect(0, 0, pixelatedCanvas.width, pixelatedCanvas.height);
        setMappedPixelData(null);
        setGridDimensions(null);
        return;
      }
      const t1FallbackColor =
        currentPalette.find((p) => p.key === 'T1') ||
        currentPalette.find((p) => p.hex.toUpperCase() === '#FFFFFF') ||
        currentPalette[0];
      console.log('Using fallback color for empty cells:', t1FallbackColor);

      const img = new window.Image();

      img.onerror = (error: Event | string) => {
        console.error('Image loading failed:', error);
        alert('无法加载图片。');
        setOriginalImageSrc(null);
        setMappedPixelData(null);
        setGridDimensions(null);
        setColorCounts(null);
      };

      img.onload = () => {
        console.log('Image loaded successfully.');
        const aspectRatio = img.height / img.width;
        setImageAspectRatio(aspectRatio);

        const N = Math.max(1, gridW);
        const M = Math.max(1, gridH);
        console.log(`Grid size: ${N}x${M}`);

        originalCanvas.width = img.width;
        originalCanvas.height = img.height;
        originalCtx.drawImage(img, 0, 0, img.width, img.height);
        console.log('Original image drawn.');

        const initialMappedData = calculatePixelGrid(
          originalCtx,
          img.width,
          img.height,
          N,
          M,
          currentPalette,
          mode,
          t1FallbackColor,
          { dithering: enableDithering, contrast, saturation },
        );
        console.log(
          `Initial data mapping complete using mode ${mode}${enableDithering ? ' + dithering' : ''}. Starting global color merging...`,
        );

        const keyToRgbMap = new Map<string, RgbColor>();
        const keyToColorDataMap = new Map<string, PaletteColor>();
        currentPalette.forEach((p) => {
          keyToRgbMap.set(p.key, p.rgb);
          keyToColorDataMap.set(p.key, p);
        });

        const initialColorCounts: { [key: string]: number } = {};
        initialMappedData.flat().forEach((cell) => {
          if (cell && cell.key && !cell.isExternal && cell.key !== TRANSPARENT_KEY) {
            initialColorCounts[cell.key] = (initialColorCounts[cell.key] || 0) + 1;
          }
        });
        console.log('Initial color counts:', initialColorCounts);

        const colorsByFrequency = Object.entries(initialColorCounts)
          .sort((a, b) => b[1] - a[1])
          .map((entry) => entry[0]);

        if (colorsByFrequency.length === 0) {
          console.log('No non-background colors found! Skipping merging.');
        }

        console.log('Colors sorted by frequency:', colorsByFrequency);

        const mergedData: MappedPixel[][] = initialMappedData.map((row) =>
          row.map((cell) => ({ ...cell, isExternal: cell.isExternal ?? false })),
        );

        const smallGrid = isSmallPixelGrid(N, M);
        // 抖动靠邻格混色保留层次；并色/清杂点会把椒盐点抹成大色块，导致「颜色都没了」
        const similarityThresholdValue = enableDithering
          ? threshold
          : smallGrid
            ? Math.max(threshold, 7) // 小图自动轻度并色（CIEDE2000），减轻碎色
            : threshold;
        const replacedColors = new Set<string>();

        if (similarityThresholdValue > 0) {
          for (let i = 0; i < colorsByFrequency.length; i++) {
            const currentKey = colorsByFrequency[i];

            if (replacedColors.has(currentKey)) continue;

            const currentRgb = keyToRgbMap.get(currentKey);
            if (!currentRgb) {
              console.warn(`RGB not found for key ${currentKey}. Skipping.`);
              continue;
            }

            for (let j = i + 1; j < colorsByFrequency.length; j++) {
              const lowerFreqKey = colorsByFrequency[j];

              if (replacedColors.has(lowerFreqKey)) continue;

              const lowerFreqRgb = keyToRgbMap.get(lowerFreqKey);
              if (!lowerFreqRgb) {
                console.warn(`RGB not found for key ${lowerFreqKey}. Skipping.`);
                continue;
              }

              const dist = colorDistance(currentRgb, lowerFreqRgb);

              if (dist < similarityThresholdValue) {
                console.log(
                  `Merging color ${lowerFreqKey} into ${currentKey} (Distance: ${dist.toFixed(2)})`,
                );

                replacedColors.add(lowerFreqKey);

                for (let r = 0; r < M; r++) {
                  for (let c = 0; c < N; c++) {
                    if (mergedData[r][c].key === lowerFreqKey) {
                      const colorData = keyToColorDataMap.get(currentKey);
                      if (colorData) {
                        mergedData[r][c] = {
                          key: currentKey,
                          color: colorData.hex,
                          isExternal: false,
                        };
                      }
                    }
                  }
                }
              }
            }
          }
        }

        if (replacedColors.size > 0) {
          console.log(
            `Merged ${replacedColors.size} less frequent similar colors into more frequent ones.`,
          );
        } else {
          console.log('No colors were similar enough to merge.');
        }

        let finalData = limitColorCount(mergedData, currentPalette, colorLimit);

        if (!enableDithering) {
          // 小图：先清空间杂点，再合并极少出现的色号
          finalData = cleanupPixelGrid(finalData, smallGrid ? 'strong' : 'normal');
          if (smallGrid) {
            const rareMin = Math.max(3, Math.floor((N * M) * 0.0015));
            finalData = mergeRareColors(finalData, currentPalette, rareMin);
            // 稀有色合并后再轻扫一轮，去掉新产生的孤点
            finalData = removeIsolatedNoise(finalData, 2, 48);
          }
        } else {
          console.log('Dithering on: skipped cleanup / rare-color merge to preserve grain.');
        }

        if (doAutoRemoveBg) {
          finalData = removeEdgeBackground(finalData, true);
        }

        if (pixelatedCanvasRef.current) {
          setMappedPixelData(finalData);
          setGridDimensions({ N, M });
          clearGridManuallyEdited();

          const { counts, total } = recountColors(finalData);
          setColorCounts(counts);
          setTotalBeadCount(total);
          console.log('Color counts updated:', counts);
          console.log('Total bead count:', total);
        } else {
          console.error('Pixelated canvas ref is null, skipping draw call in pixelateImage.');
        }
      };

      console.log('Setting image source...');
      img.src = imageSrc;
      setSelectedColor(null);
    },
    [
      originalCanvasRef,
      pixelatedCanvasRef,
      setMappedPixelData,
      setGridDimensions,
      setOriginalImageSrc,
      setColorCounts,
      setImageAspectRatio,
      setTotalBeadCount,
      setSelectedColor,
      clearGridManuallyEdited,
    ],
  );

  // 当 remapTrigger 变化时清空撤回历史（参数调整/新图上传等均会触发 remap）
  useEffect(() => {
    clearEditHistory();
    setBgRemovalSnapshot(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remapTrigger]);

  // 参数变更时触发重像素化（含草稿锁 / 抑制窗口）
  useEffect(() => {
    // 已手改：禁止静默从原图重算，须用户点「重新生成」
    if (gridManuallyEdited) {
      return;
    }
    const lock = draftPixelateLockRef.current;
    if (lock?.locked) {
      const unchanged =
        lock.granularity === granularity &&
        lock.gridHeight === gridHeight &&
        lock.similarityThreshold === similarityThreshold &&
        lock.maxColorCount === maxColorCount &&
        lock.autoRemoveWhiteBg === autoRemoveWhiteBg &&
        lock.pixelationMode === pixelationMode &&
        lock.ditheringEnabled === ditheringEnabled &&
        lock.imageContrast === imageContrast &&
        lock.imageSaturation === imageSaturation &&
        lock.remapTrigger === remapTrigger;
      if (unchanged) {
        return;
      }
      draftPixelateLockRef.current = null;
    }
    if (Date.now() < suppressPixelateUntilRef.current) {
      return;
    }
    if (originalImageSrc && activeBeadPalette.length > 0) {
      const timeoutId = setTimeout(() => {
        if (Date.now() < suppressPixelateUntilRef.current) {
          return;
        }
        if (
          originalImageSrc &&
          originalCanvasRef.current &&
          pixelatedCanvasRef.current &&
          activeBeadPalette.length > 0
        ) {
          console.log(
            'useEffect triggered: Processing image due to src, size, threshold, palette, mode, colorLimit or remap trigger.',
          );
          pixelateImage(
            originalImageSrc,
            granularity,
            gridHeight,
            similarityThreshold,
            activeBeadPalette,
            pixelationMode,
            maxColorCount,
            autoRemoveWhiteBg,
            ditheringEnabled,
            imageContrast,
            imageSaturation,
          );
        } else {
          console.warn(
            'useEffect check failed inside timeout: Refs or active palette not ready/empty.',
          );
        }
      }, 50);
      return () => clearTimeout(timeoutId);
    } else if (originalImageSrc && activeBeadPalette.length === 0) {
      const { paletteHydrated, mappedPixelData: existingGrid } = useEditorStore.getState();
      // 色板尚未水合，或已有恢复的图纸：不要清空（刷新竞态）
      if (!paletteHydrated || (existingGrid && existingGrid.length > 0)) {
        return;
      }
      console.warn(
        'Image selected, but the active palette is empty. Cannot process. Clearing preview.',
      );
      const pixelatedCanvas = pixelatedCanvasRef.current;
      const pixelatedCtx = pixelatedCanvas?.getContext('2d');
      if (pixelatedCtx && pixelatedCanvas) {
        pixelatedCtx.clearRect(0, 0, pixelatedCanvas.width, pixelatedCanvas.height);
        pixelatedCtx.fillStyle = '#6b7280';
        pixelatedCtx.font = '16px sans-serif';
        pixelatedCtx.textAlign = 'center';
        pixelatedCtx.fillText(
          '无可用颜色，请在色板管理中勾选颜色',
          pixelatedCanvas.width / 2,
          pixelatedCanvas.height / 2,
        );
      }
      setMappedPixelData(null);
      setGridDimensions(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    originalImageSrc,
    granularity,
    gridHeight,
    similarityThreshold,
    customPaletteSelections,
    pixelationMode,
    ditheringEnabled,
    imageContrast,
    imageSaturation,
    maxColorCount,
    autoRemoveWhiteBg,
    remapTrigger,
    gridManuallyEdited,
  ]);

  /** 应用新原图（预处理确认后）并重新生成图纸 */
  const applyPreparedImage = useCallback((dataUrl: string) => {
    setSelectedCells(new Set());
    setShowSelectionRecolor(false);
    setCropRect(null);
    setCanvasToolMode('select');
    setSelectedColor(null);
    setOriginalImageSrc(dataUrl);
    setRemapTrigger((prev) => prev + 1);
  }, [
    setSelectedCells,
    setShowSelectionRecolor,
    setCropRect,
    setCanvasToolMode,
    setSelectedColor,
    setOriginalImageSrc,
    setRemapTrigger,
  ]);

  const openImagePrep = useCallback((src: string) => {
    setPendingPrepImageSrc(src);
    setIsImagePrepOpen(true);
  }, []);

  const handlePrepConfirm = useCallback(
    (preparedDataUrl: string, meta: { usedAiMatting: boolean }) => {
      if (meta.usedAiMatting && pendingPrepImageSrc) {
        setPreAiImageSrc(pendingPrepImageSrc);
        setAutoRemoveWhiteBg(true);
      }

      const probe = new window.Image();
      probe.onload = () => {
        const ratio = probe.height / Math.max(1, probe.width);
        setImageAspectRatio(ratio);
        const defaultW = 50;
        const defaultH = Math.max(10, Math.min(300, Math.round(defaultW * ratio)));
        setGranularity(defaultW);
        setGranularityInput(String(defaultW));
        setGridHeight(defaultH);
        setGridHeightInput(String(defaultH));
        applyPreparedImage(preparedDataUrl);
        setIsImagePrepOpen(false);
        setPendingPrepImageSrc(null);
        showToast(meta.usedAiMatting ? '已抠图并生成图纸' : '已裁剪并生成图纸');
      };
      probe.onerror = () => {
        applyPreparedImage(preparedDataUrl);
        setIsImagePrepOpen(false);
        setPendingPrepImageSrc(null);
      };
      probe.src = preparedDataUrl;
    },
    [
      pendingPrepImageSrc,
      applyPreparedImage,
      showToast,
      setPreAiImageSrc,
      setAutoRemoveWhiteBg,
      setImageAspectRatio,
      setGranularity,
      setGranularityInput,
      setGridHeight,
      setGridHeightInput,
    ],
  );

  const handlePrepCancel = useCallback(() => {
    setIsImagePrepOpen(false);
    setPendingPrepImageSrc(null);
  }, []);

  const handleUndoAiMatting = useCallback(() => {
    if (!preAiImageSrc) return;
    openImagePrep(preAiImageSrc);
    setPreAiImageSrc(null);
    showToast('已恢复抠图前原图，请重新确认');
  }, [preAiImageSrc, openImagePrep, showToast, setPreAiImageSrc]);

  return {
    pixelateImage,
    applyPreparedImage,
    openImagePrep,
    handlePrepConfirm,
    handlePrepCancel,
    handleUndoAiMatting,
    pendingPrepImageSrc,
    isImagePrepOpen,
  };
}
