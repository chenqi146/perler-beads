'use client';

import React, { useState, useRef, useEffect, useLayoutEffect, useMemo, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Script from 'next/script';

// 导入像素化工具和类型
import {
  MappedPixel,
} from '../utils/pixelation';
import { TRANSPARENT_KEY } from '../domain/pixelation';

// 导入新的类型和组件
import { IconButton } from '../components/ui/IconButton';
import { Overlay } from '../components/ui/Overlay';
import DownloadSettingsModal from '../components/DownloadSettingsModal';
import { PageLoading } from '../components/ui/PageLoading';

import { 
  convertPaletteToColorSystem, 
  getColorKeyByHex,
  sortColorsByHue,
} from '../utils/colorSystemUtils';
import { fullBeadPalette } from '../domain/palette/fullBeadPalette';

// 添加自定义动画样式
const floatAnimation = `
  @keyframes float {
    0% { transform: translateY(0px); }
    50% { transform: translateY(-5px); }
    100% { transform: translateY(0px); }
  }
  .animate-float {
    animation: float 3s ease-in-out infinite;
  }
`;

// 1. 导入新组件
import ImagePrepModal from '../components/ImagePrepModal';
import GridTooltip from '../components/GridTooltip';
import SelectionRecolorModal from '../components/SelectionRecolorModal';

import IngredientBillModal from '../components/IngredientBillModal';
import { PaletteManageModal } from '../components/PaletteManageModal';
import EnsureSession from '../components/EnsureSession';
import PatternSaveModal from '../components/PatternSaveModal';
import {
  useAppNavSubtitle,
  WorkbenchRoot,
  WorkbenchMobileHeader,
  WorkbenchTips,
  WorkbenchSplit,
  WorkbenchDesktopOnly,
  WorkbenchMobileFooter,
} from '../components/shell';
import {
  EditorPageToolbar,
  EditorUploadPanel,
  EditorSettingsPanel,
  EditorColorStatsPanel,
  EditorZoomControls,
  EditorCanvasWorkspace,
} from '../components/editor';
import {
  usePatternStore,
  useEditorStore,
  useEditorDocument,
  useEditorPaletteState,
  useEditorToolState,
  useEditorUiViewport,
  useEditorSettings,
  useEditorHistory,
  useEditorPatternActions,
  usePatternAutosave,
  useCanvasViewport,
  measureCanvasPixels,
  applyZoomAtPoint,
  useEditorUiStore,
  usePixelationPipeline,
  usePatternExport,
  useEditorCanvasTools,
  useProjectDraft,
  useCanvasInteraction,
  useImageUpload,
} from '../stores';
import { applyImagePrepConfirmToStore } from '../application/editor/imagePrepSync';

function Editor() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentPatternId = searchParams.get('patternId') || undefined;
  const [patternName, setPatternName] = useState('未命名图纸');
  const [patternDescription, setPatternDescription] = useState('');
  const [patternVisibility, setPatternVisibility] = useState<'private' | 'public'>('private');
  const [isPatternInfoOpen, setIsPatternInfoOpen] = useState(false);
  const [mobileSettingsOpen, setMobileSettingsOpen] = useState(false);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [isNarrowScreen, setIsNarrowScreen] = useState(false);
  /** 成品预览：隐藏色号与网格线，看拼豆成品效果 */
  const [finishedPreview, setFinishedPreview] = useState(false);
  const {
    mappedPixelData,
    gridDimensions,
    colorCounts,
    totalBeadCount,
    originalImageSrc,
    preAiImageSrc,
  } = useEditorDocument();

  const {
    selectedColorSystem,
    setSelectedColorSystem,
    activeBeadPalette,
    setActiveBeadPalette,
    customPaletteSelections,
  } = useEditorPaletteState();

  const {
    canvasToolMode,
    setCanvasToolMode,
    selectedCells,
    cropRect,
    setCropRect,
    showSelectionRecolor,
    setShowSelectionRecolor,
  } = useEditorToolState();

  const {
    previewZoom,
    setPreviewZoom,
    canvasOffset,
    setCanvasOffset,
    panBy,
    highlightColorKey,
    uploadMode,
    setUploadMode,
    isRecognizingPattern,
  } = useEditorUiViewport();

  const originalCanvasRef = useRef<HTMLCanvasElement>(null);
  const pixelatedCanvasRef = useRef<HTMLCanvasElement>(null);
  /** 裁剪/撤回后短暂抑制整图重像素化 */
  const suppressPixelateUntilRef = useRef(0);

  const { draftPixelateLockRef, draftReadyToSaveRef, draftSaveHint } = useProjectDraft({
    currentPatternId,
    suppressPixelateUntilRef,
  });

  // 必须在草稿恢复 / 像素化 effect 之前水合色板，否则空选会清空图纸
  useLayoutEffect(() => {
    useEditorStore.getState().hydratePaletteSelections();
  }, []);

  useEffect(() => {
    if (!currentPatternId) return;
    const pattern = usePatternStore.getState().loadPattern(currentPatternId);
    if (!pattern) return;

    setPatternName(pattern.name);
    setPatternDescription(pattern.description);
    setPatternVisibility(pattern.visibility);
    // 切换图纸时先清掉上一张的残留（含草稿异步回填），再水合
    useEditorStore.getState().resetDocument();
    useEditorStore.getState().hydrateFromPatternData(pattern.data);
    const s = useEditorStore.getState();
    draftPixelateLockRef.current = {
      locked: true,
      granularity: s.granularity,
      gridHeight: s.gridHeight,
      similarityThreshold: s.similarityThreshold,
      maxColorCount: s.maxColorCount,
      autoRemoveWhiteBg: s.autoRemoveWhiteBg,
      pixelationMode: s.pixelationMode,
      ditheringEnabled: s.ditheringEnabled,
      imageContrast: s.imageContrast,
      imageSaturation: s.imageSaturation,
      remapTrigger: s.remapTrigger,
    };
    // 原图从 IDB/R2 异步回填前抑制重算，避免冲掉已保存格子
    suppressPixelateUntilRef.current = Date.now() + 4000;
    draftReadyToSaveRef.current = true;

    const isEmptyPattern =
      !pattern.data.mappedPixelData?.length || !pattern.data.gridDimensions?.N;

    let cancelled = false;
    void (async () => {
      // 新建空图纸：不要回填任何原图
      if (isEmptyPattern) return;
      const { getOriginalImage, putOriginalImage } = await import('../infrastructure/storage');
      let src = await getOriginalImage(currentPatternId);
      if (!src) {
        const key = pattern.data.originalImageKey;
        if (key) {
          const { fetchOriginalImageAsDataUrl } = await import('../utils/patternOriginalUpload');
          src = await fetchOriginalImageAsDataUrl(key);
          if (src) await putOriginalImage(currentPatternId, src);
        }
      }
      if (cancelled || !src) return;
      // 回填前再次对齐锁到当前 store，防止异步期间参数微调导致锁失效而重像素化
      const live = useEditorStore.getState();
      draftPixelateLockRef.current = {
        locked: true,
        granularity: live.granularity,
        gridHeight: live.gridHeight,
        similarityThreshold: live.similarityThreshold,
        maxColorCount: live.maxColorCount,
        autoRemoveWhiteBg: live.autoRemoveWhiteBg,
        pixelationMode: live.pixelationMode,
        ditheringEnabled: live.ditheringEnabled,
        imageContrast: live.imageContrast,
        imageSaturation: live.imageSaturation,
        remapTrigger: live.remapTrigger,
      };
      suppressPixelateUntilRef.current = Date.now() + 2000;
      live.setOriginalImageSrc(src);
      if (pattern.data.originalImageKey) {
        live.setOriginalImageKey(pattern.data.originalImageKey);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    currentPatternId,
    draftPixelateLockRef,
    draftReadyToSaveRef,
    suppressPixelateUntilRef,
  ]);

  // 编辑页锁定整页滚动，保证一屏展示
  useEffect(() => {
    const html = document.documentElement;
    const { overflow: prevHtmlOverflow } = html.style;
    const { overflow: prevBodyOverflow } = document.body.style;
    html.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    return () => {
      html.style.overflow = prevHtmlOverflow;
      document.body.style.overflow = prevBodyOverflow;
    };
  }, []);

  // Store 默认 activeBeadPalette 为空：首次挂载时用全色板兜底
  useEffect(() => {
    if (useEditorStore.getState().activeBeadPalette.length === 0) {
      setActiveBeadPalette(fullBeadPalette);
    }
  }, [setActiveBeadPalette]);

  const [tooltipData, setTooltipData] = useState<{ x: number, y: number, key: string, color: string } | null>(null);

  const canvasViewportRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)');
    const sync = () => setIsNarrowScreen(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  // 新增：轻量提示
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2000);
  }, []);

  const {
    editHistory,
    editRedo,
    bgRemovalSnapshot,
    saveEditSnapshot,
    handleUndoEdit,
    handleRedoEdit,
    handleUndoBgRemoval,
    clearEditHistory,
    setBgRemovalSnapshot,
  } = useEditorHistory({ suppressPixelateUntilRef, showToast });

  const preserveHistoryOnRemapRef = useRef(false);
  const clearHistoryForRemap = useCallback(() => {
    if (preserveHistoryOnRemapRef.current) {
      preserveHistoryOnRemapRef.current = false;
      return;
    }
    clearEditHistory();
  }, [clearEditHistory]);
  const prepareHistoryForRegenerate = useCallback(() => {
    preserveHistoryOnRemapRef.current = true;
    saveEditSnapshot();
  }, [saveEditSnapshot]);

  const {
    keepAspectRatio,
    setKeepAspectRatio,
    granularity,
    granularityInput,
    gridHeight,
    gridHeightInput,
    similarityThresholdInput,
    maxColorCount,
    setMaxColorCount,
    autoRemoveWhiteBg,
    setAutoRemoveWhiteBg,
    pixelationMode,
    creativePreset,
    ditheringEnabled,
    imageContrast,
    setImageContrast,
    imageSaturation,
    setImageSaturation,
    remapTrigger,
    handleGranularityInputChange,
    handleGridHeightInputChange,
    applyGridWidth,
    applyGridHeight,
    flushSimilarity,
    handleSimilarityThresholdInputChange,
    handlePixelationModeChange,
    handleCreativePresetChange,
    handleDitheringChange,
    gridManuallyEdited,
    sizePending,
    scaleGridToInputs,
    regenerateFromOriginal,
  } = useEditorSettings({ showToast, beforeRegenerate: prepareHistoryForRegenerate });

  const {
    isDownloadSettingsOpen,
    setIsDownloadSettingsOpen,
    downloadOptions,
    setDownloadOptions,
    exportPreviewUrl,
    isExportPreviewLoading,
    closeExportDialog,
    handlePreviewExport,
    handleConfirmExportDownload,
    isIngredientBillOpen,
    setIsIngredientBillOpen,
    ingredientBill,
  } = usePatternExport();

  const {
    openImagePrep,
    handlePrepConfirm,
    handlePrepCancel,
    handleUndoAiMatting,
    pendingPrepImageSrc,
    isImagePrepOpen,
  } = usePixelationPipeline({
    originalCanvasRef,
    pixelatedCanvasRef,
    draftPixelateLockRef,
    suppressPixelateUntilRef,
    showToast,
    clearEditHistory: clearHistoryForRemap,
  });

  const {
    fileInputRef,
    isMounted,
    triggerFileInput,
    handleFileChange,
    handleDrop,
    handleDragOver,
    stagedUploadSrc,
    clearStagedUpload,
    startUploadModeProcess,
    handleRecognizeRegionConfirm,
  } = useImageUpload({
    openImagePrep,
    showToast,
  });

  // 切换图纸时清掉待处理上传，避免旧图残留
  useEffect(() => {
    clearStagedUpload();
  }, [currentPatternId, clearStagedUpload]);

  const { handleSavePattern, handleStartBeading } = useEditorPatternActions({
    patternName,
    patternDescription,
    patternVisibility,
    currentPatternId,
    onToast: showToast,
    onSavedMetaClose: () => setIsPatternInfoOpen(false),
  });

  const { autosaveStatus } = usePatternAutosave({
    currentPatternId,
    patternName,
    patternDescription,
    patternVisibility,
  });

  const { fitCanvasToViewport } = useCanvasViewport(canvasViewportRef);

  const handlePinchZoom = useCallback((scale: number, centerClient: { x: number; y: number }) => {
    const el = canvasViewportRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const ui = useEditorUiStore.getState();
    applyZoomAtPoint({
      currentZoom: ui.previewZoom,
      nextZoom: ui.previewZoom * scale,
      offset: ui.canvasOffset,
      point: { x: centerClient.x - rect.left, y: centerClient.y - rect.top },
      setPreviewZoom: ui.setPreviewZoom,
      setCanvasOffset: ui.setCanvasOffset,
    });
  }, []);

  const {
    handleSelectCells,
    handleClearCellSelection,
    handleApplyColorToSelection,
    handleOpenSelectionRecolor,
    handleSelectAllByColor,
    handleConfirmCrop,
    handleAutoCrop,
  } = useEditorCanvasTools({
    saveEditSnapshot,
    suppressPixelateUntilRef,
  });

  // ++ Add a ref for the main element ++
  const mainRef = useRef<HTMLElement>(null);

  const {
    handleCanvasInteraction,
    handleAutoRemoveBackground,
    handleHighlightComplete,
  } = useCanvasInteraction({
    setBgRemovalSnapshot,
    clearEditHistory,
    pixelatedCanvasRef,
    mainRef,
    tooltipData,
    setTooltipData,
  });

  // --- Derived State ---

  // Update active palette based on custom selections
  useEffect(() => {
    if (!useEditorStore.getState().paletteHydrated) return;
    if (Object.keys(customPaletteSelections).length === 0) return;

    const newActiveBeadPalette = fullBeadPalette.filter((color) => {
      const normalizedHex = color.hex.toUpperCase();
      return customPaletteSelections[normalizedHex];
    });
    // 根据选择的色号系统转换调色板
    const convertedPalette = convertPaletteToColorSystem(newActiveBeadPalette, selectedColorSystem);
    setActiveBeadPalette(convertedPalette);
  }, [customPaletteSelections, remapTrigger, selectedColorSystem, setActiveBeadPalette]);

  // ++ Calculate unique colors currently on the grid for the palette ++
  const currentGridColors = useMemo(() => {
    if (!mappedPixelData) return [];
    // 使用hex值进行去重，避免多个MARD色号对应同一个目标色号系统值时产生重复key
    const uniqueColorsMap = new Map<string, MappedPixel>();
    mappedPixelData.flat().forEach(cell => {
      if (cell && cell.color && !cell.isExternal) {
        const hexKey = cell.color.toUpperCase();
        if (!uniqueColorsMap.has(hexKey)) {
          // 存储hex值作为key，保持颜色信息
          uniqueColorsMap.set(hexKey, { key: cell.key, color: cell.color });
        }
      }
    });
    
    // 转换为数组并为每个hex值生成对应的色号系统显示
    const originalColors = Array.from(uniqueColorsMap.values());
    
    const colorData = originalColors.map(color => {
      const displayKey = getColorKeyByHex(color.color.toUpperCase(), selectedColorSystem);
      return {
        key: displayKey,
        color: color.color
      };
    });

    // 使用色相排序而不是色号排序
    return sortColorsByHue(colorData);
  }, [mappedPixelData, selectedColorSystem]);

  // 色板选择由 useLayoutEffect → hydratePaletteSelections 完成

  // Escape 清选区；D 擦除选中格；Ctrl/Cmd+Z 撤回；Ctrl/Cmd+Shift+Z 或 Ctrl/Cmd+Y 重做
  useEffect(() => {
    const isTypingTarget = (target: EventTarget | null) => {
      const el = target as HTMLElement | null;
      const tag = el?.tagName?.toLowerCase();
      return tag === 'input' || tag === 'textarea' || tag === 'select' || !!el?.isContentEditable;
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (event.defaultPrevented) return;
        if (showSelectionRecolor) {
          setShowSelectionRecolor(false);
          return;
        }
        if (selectedCells.size > 0 || highlightColorKey) {
          handleClearCellSelection();
          return;
        }
      }

      const isMod = event.ctrlKey || event.metaKey;
      if (!isMod && !isTypingTarget(event.target)) {
        const key = event.key.toLowerCase();
        // D：擦除当前选中格子
        if (key === 'd' && selectedCells.size > 0 && !event.altKey && !event.shiftKey) {
          event.preventDefault();
          handleApplyColorToSelection({ key: TRANSPARENT_KEY, color: '#FFFFFF' });
          return;
        }
      }

      if (!isMod) return;
      if (isTypingTarget(event.target)) return;

      const key = event.key.toLowerCase();
      const isRedo = (key === 'z' && event.shiftKey) || key === 'y';
      const isUndo = key === 'z' && !event.shiftKey;

      if (isRedo) {
        if (editRedo.length === 0) return;
        event.preventDefault();
        handleRedoEdit();
        return;
      }
      if (!isUndo) return;
      if (editHistory.length === 0) return;
      event.preventDefault();
      handleUndoEdit();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    editHistory.length,
    editRedo.length,
    handleUndoEdit,
    handleRedoEdit,
    showSelectionRecolor,
    setShowSelectionRecolor,
    selectedCells.size,
    highlightColorKey,
    handleClearCellSelection,
    handleApplyColorToSelection,
  ]);

  useAppNavSubtitle(patternName.trim() || '未命名图纸');

  return (
    <>
    {/* 添加自定义动画样式 */}
    <style dangerouslySetInnerHTML={{ __html: floatAnimation }} />
    <style dangerouslySetInnerHTML={{ __html: '@keyframes toastFadeInOut{0%{opacity:0;transform:translate(-50%,10px)}15%{opacity:1;transform:translate(-50%,0)}85%{opacity:1;transform:translate(-50%,0)}100%{opacity:0;transform:translate(-50%,-10px)}}' }} />
    <PatternSaveModal
      open={isPatternInfoOpen}
      name={patternName}
      description={patternDescription}
      visibility={patternVisibility}
      onNameChange={setPatternName}
      onDescriptionChange={setPatternDescription}
      onVisibilityChange={setPatternVisibility}
      onClose={() => setIsPatternInfoOpen(false)}
      onSave={handleSavePattern}
    />
    
    {/* ++ 修改：添加 onLoad 回调函数 ++ */}
    <Script
      async
      src="//busuanzi.ibruce.info/busuanzi/2.3/busuanzi.pure.mini.js"
      strategy="lazyOnload"
      onLoad={() => {
        const basePV = 378536; // ++ 预设 PV 基数 ++
        const baseUV = 257864; // ++ 预设 UV 基数 ++

        const updateCount = (spanId: string, baseValue: number) => {
          const targetNode = document.getElementById(spanId);
          if (!targetNode) return;

          const observer = new MutationObserver((mutationsList) => {
            for (const mutation of mutationsList) {
              if (mutation.type === 'childList' || mutation.type === 'characterData') {
                const currentValueText = targetNode.textContent?.trim() || '0';
                if (currentValueText !== '...') {
                  const currentValue = parseInt(currentValueText.replace(/,/g, ''), 10) || 0;
                  targetNode.textContent = (currentValue + baseValue).toLocaleString();
                  observer.disconnect(); // ++ 更新后停止观察 ++ 
                  // console.log(`Updated ${spanId} from ${currentValueText} to ${targetNode.textContent}`);
                  break; // 处理完第一个有效更新即可
                }
              }
            }
          });

          observer.observe(targetNode, { childList: true, characterData: true, subtree: true });

          // ++ 处理初始值已经是数字的情况 (如果脚本加载很快) ++
          const initialValueText = targetNode.textContent?.trim() || '0';
          if (initialValueText !== '...') {
             const initialValue = parseInt(initialValueText.replace(/,/g, ''), 10) || 0;
             targetNode.textContent = (initialValue + baseValue).toLocaleString();
             observer.disconnect(); // 已更新，无需再观察
          }
        };

        updateCount('busuanzi_value_site_pv', basePV);
        updateCount('busuanzi_value_site_uv', baseUV);
      }}
    />

    {/* 编辑工作区：手机补充当前图纸上下文，桌面沿用全局顶栏 */}
    <WorkbenchRoot>
      <WorkbenchMobileHeader
        title={patternName.trim() || '未命名图纸'}
        badge="编辑模式"
        onBack={() => router.push('/dashboard')}
        backAriaLabel="返回我的图纸"
      />
      <main ref={mainRef} className="relative flex h-full min-h-0 w-full flex-1 flex-col">
        <WorkbenchSplit
          side="left"
          sidePanel={
            <>
              <EditorUploadPanel
                originalImageSrc={originalImageSrc}
                preAiImageSrc={preAiImageSrc}
                stagedUploadSrc={stagedUploadSrc}
                pendingPrepImageSrc={pendingPrepImageSrc}
                isImagePrepOpen={isImagePrepOpen}
                isMounted={isMounted}
                hasPatternGrid={Boolean(mappedPixelData?.length && gridDimensions && gridDimensions.N > 0)}
                onStartUploadModeProcess={startUploadModeProcess}
                isRecognizingPattern={isRecognizingPattern}
                onUndoAiMatting={handleUndoAiMatting}
                onTriggerFileInput={triggerFileInput}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
              />

              <EditorSettingsPanel
                mappedPixelData={mappedPixelData}
                gridDimensions={gridDimensions}
                selectedColorSystem={selectedColorSystem}
                onSelectedColorSystemChange={setSelectedColorSystem}
                keepAspectRatio={keepAspectRatio}
                onKeepAspectRatioChange={setKeepAspectRatio}
                granularityInput={granularityInput}
                gridHeightInput={gridHeightInput}
                onGranularityInputChange={handleGranularityInputChange}
                onGridHeightInputChange={handleGridHeightInputChange}
                onApplyGridWidth={applyGridWidth}
                onApplyGridHeight={applyGridHeight}
                maxColorCount={maxColorCount}
                onMaxColorCountChange={setMaxColorCount}
                autoRemoveWhiteBg={autoRemoveWhiteBg}
                onAutoRemoveWhiteBgChange={setAutoRemoveWhiteBg}
                similarityThresholdInput={similarityThresholdInput}
                onSimilarityThresholdInputChange={handleSimilarityThresholdInputChange}
                onApplySimilarity={flushSimilarity}
                creativePreset={creativePreset}
                onCreativePresetChange={handleCreativePresetChange}
                ditheringEnabled={ditheringEnabled}
                onDitheringChange={handleDitheringChange}
                imageContrast={imageContrast}
                onImageContrastChange={setImageContrast}
                imageSaturation={imageSaturation}
                onImageSaturationChange={setImageSaturation}
                pixelationMode={pixelationMode}
                onPixelationModeChange={handlePixelationModeChange}
                customPaletteSelections={customPaletteSelections}
                onManagePalette={() => setIsPaletteOpen(true)}
                onAutoRemoveBackground={handleAutoRemoveBackground}
                onUndoBgRemoval={handleUndoBgRemoval}
                bgRemovalSnapshot={bgRemovalSnapshot}
                gridManuallyEdited={gridManuallyEdited}
                sizePending={sizePending}
                onScaleGrid={scaleGridToInputs}
                onRegenerateFromOriginal={regenerateFromOriginal}
              />

              {originalImageSrc && activeBeadPalette.length === 0 && useEditorStore.getState().paletteHydrated && (
                <div className="w-full rounded-lg border border-yellow-200 bg-yellow-100 p-4 text-center text-sm text-yellow-800 shadow dark:border-yellow-800/60 dark:bg-yellow-900/50 dark:text-yellow-300">
                  当前可用颜色过少或为空。请点击「管理色板」勾选颜色。
                </div>
              )}

              {originalImageSrc && mappedPixelData && (
                <div className="mt-4 w-full">
                  <button
                    type="button"
                    onClick={() => setIsIngredientBillOpen(true)}
                    disabled={!ingredientBill}
                    className="app-btn app-btn--secondary app-btn--block app-btn--md"
                  >
                    采购清单
                    {ingredientBill ? ` · ${ingredientBill.colorCount} 色` : ''}
                  </button>
                </div>
              )}
            </>
          }
        >
          {/* 右侧：图纸预览，占满剩余高度 */}
          <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-[#eadfce] bg-white p-2 sm:p-4">
              <div className="mb-2 flex shrink-0 flex-col gap-2">
                <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <h2 className="text-sm font-semibold text-[#3a2416] dark:text-gray-100">图纸预览</h2>
                    {gridDimensions && <span className="rounded-md bg-[#f3e6d4] px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-[#8a6a4a] dark:bg-gray-800 dark:text-gray-400">{gridDimensions.N} × {gridDimensions.M}</span>}
                    {mappedPixelData ? (
                      <button
                        type="button"
                        onClick={() => setFinishedPreview((v) => !v)}
                        aria-pressed={finishedPreview}
                        title={finishedPreview ? '显示色号与网格' : '隐藏色号与网格，看成品效果'}
                        className={[
                          'inline-flex h-7 touch-manipulation items-center gap-1 rounded-lg px-2 text-[11px] font-medium transition-colors',
                          finishedPreview
                            ? 'bg-[#c47a2c] text-white'
                            : 'bg-[#f3e6d4] text-[#5c4030] hover:bg-[#eadfce] dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700',
                        ].join(' ')}
                      >
                        {finishedPreview ? '成品预览开' : '成品预览'}
                      </button>
                    ) : null}
                  </div>
                  <EditorPageToolbar
                    showAutosave={Boolean(currentPatternId)}
                    autosaveStatus={autosaveStatus}
                    canUndo={editHistory.length > 0}
                    canRedo={editRedo.length > 0}
                    onUndo={handleUndoEdit}
                    onRedo={handleRedoEdit}
                    onStartBeading={handleStartBeading}
                    onExport={() => setIsDownloadSettingsOpen(true)}
                    canExport={Boolean(
                      mappedPixelData &&
                        gridDimensions &&
                        gridDimensions.N > 0 &&
                        gridDimensions.M > 0 &&
                        activeBeadPalette.length > 0
                    )}
                    onSave={() => {
                      if (currentPatternId) handleSavePattern();
                      else setIsPatternInfoOpen(true);
                    }}
                  />
                </div>
                <WorkbenchTips
                  desktop="单击选/取消单格 · 拖拽框选 · Shift+点击同色连通块加选/再点取消（含对角）· D 擦除选中格 · 空格或空白处拖动画布 · Ctrl/⌘+Z 撤回"
                  mobile="点格选中 · 拖动画布 · 双指缩放 · 底栏改色或调整"
                />
              </div>

              <canvas ref={originalCanvasRef} className="hidden"></canvas>
              <input
                type="file"
                accept="image/jpeg, image/png, image/gif, .csv, text/csv, application/csv, text/plain"
                onChange={handleFileChange}
                ref={fileInputRef}
                className="hidden"
              />

              {/* 画布 + 右侧色块统计 */}
              <div className="flex min-h-0 flex-1 flex-col gap-2 lg:flex-row lg:gap-3">
                <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
                <EditorCanvasWorkspace
                  viewportRef={canvasViewportRef}
                  canvasRef={pixelatedCanvasRef}
                  mappedPixelData={mappedPixelData}
                  gridDimensions={gridDimensions}
                  originalImageSrc={originalImageSrc}
                  previewZoom={previewZoom}
                  canvasOffset={canvasOffset}
                  panBy={panBy}
                  highlightColorKey={highlightColorKey}
                  onHighlightComplete={handleHighlightComplete}
                  selectedColorSystem={selectedColorSystem}
                  toolMode={canvasToolMode}
                  selectedCells={selectedCells}
                  onSelectCells={handleSelectCells}
                  onSelectionDoubleClick={handleOpenSelectionRecolor}
                  cropRect={cropRect}
                  onCropRectChange={setCropRect}
                  onInteraction={handleCanvasInteraction}
                  onPinchZoom={handlePinchZoom}
                  showCellKeys={!finishedPreview}
                  showGrid={!finishedPreview}
                  onEmptyUploadClick={isMounted ? triggerFileInput : undefined}
                >
                  {originalImageSrc && (
                    <div
                      className="pointer-events-auto absolute inset-x-0 bottom-3 z-30 hidden justify-center px-3 lg:flex"
                      onPointerDown={(event) => event.stopPropagation()}
                    >
                      <div className="flex max-w-full items-center gap-0.5 overflow-x-auto rounded-xl border border-gray-200 bg-white/95 p-1 shadow-lg backdrop-blur dark:border-gray-700 dark:bg-gray-900/95">
                        <IconButton
                          aria-label={canvasToolMode === 'crop' ? '退出裁剪' : '矩形裁剪'}
                          title={canvasToolMode === 'crop' ? '退出裁剪' : '矩形裁剪'}
                          disabled={!mappedPixelData}
                          isActive={canvasToolMode === 'crop'}
                          onClick={() => {
                            if (canvasToolMode === 'crop') {
                              setCropRect(null);
                              setCanvasToolMode('select');
                              return;
                            }
                            setCanvasToolMode('crop');
                            handleClearCellSelection();
                          }}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V6a2 2 0 012-2h2M16 4h2a2 2 0 012 2v2M20 16v2a2 2 0 01-2 2h-2M8 20H6a2 2 0 01-2-2v-2" />
                          </svg>
                        </IconButton>
                        <IconButton
                          aria-label="自动裁边"
                          title="自动裁边"
                          disabled={!mappedPixelData}
                          onClick={handleAutoCrop}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M7 4v3m10-3v3M6 20h12a2 2 0 002-2V9H4v9a2 2 0 002 2z" />
                          </svg>
                        </IconButton>
                        {canvasToolMode === 'crop' && cropRect && (
                          <>
                            <IconButton
                              aria-label="确认裁剪"
                              title="确认裁剪"
                              tone="amber"
                              onClick={handleConfirmCrop}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            </IconButton>
                            <IconButton
                              aria-label="取消裁剪"
                              title="取消裁剪"
                              onClick={() => {
                                setCropRect(null);
                                setCanvasToolMode('select');
                              }}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </IconButton>
                          </>
                        )}
                        <EditorZoomControls
                          previewZoom={previewZoom}
                          canFit={!!(mappedPixelData && gridDimensions)}
                          onFit={fitCanvasToViewport}
                          onZoomOut={() =>
                            setPreviewZoom(
                              Math.max(0.25, Math.round((previewZoom - 0.25) * 100) / 100),
                            )
                          }
                          onResetZoom={() => {
                            setPreviewZoom(1);
                            // 100% 后重新居中
                            requestAnimationFrame(() => {
                              const el = canvasViewportRef.current;
                              if (!el || !gridDimensions) return;
                              const { width, height } = measureCanvasPixels(gridDimensions.N, gridDimensions.M, 1);
                              setCanvasOffset({
                                x: Math.round((el.clientWidth - width) / 2),
                                y: Math.round((el.clientHeight - height) / 2),
                              });
                            });
                          }}
                          onZoomIn={() =>
                            setPreviewZoom(
                              Math.min(3, Math.round((previewZoom + 0.25) * 100) / 100),
                            )
                          }
                        />
                        <IconButton
                          aria-label={finishedPreview ? '退出成品预览' : '成品预览'}
                          title={finishedPreview ? '退出成品预览（显示色号与网格）' : '成品预览（隐藏色号与网格）'}
                          isActive={finishedPreview}
                          disabled={!mappedPixelData}
                          onClick={() => setFinishedPreview((v) => !v)}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12s3.75-6.75 9.75-6.75S21.75 12 21.75 12s-3.75 6.75-9.75 6.75S2.25 12 2.25 12z" />
                            <circle cx="12" cy="12" r="2.75" />
                          </svg>
                        </IconButton>
                        {selectedCells.size > 0 && (
                          <>
                            <span className="mx-1 h-5 w-px shrink-0 bg-gray-200 dark:bg-gray-700" />
                            <span className="shrink-0 px-1 text-[11px] font-medium text-blue-600 dark:text-blue-400">
                              {selectedCells.size}
                            </span>
                            <IconButton
                              aria-label="清除选择"
                              title="清除选择"
                              onClick={handleClearCellSelection}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </IconButton>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </EditorCanvasWorkspace>

                <WorkbenchMobileFooter className="grid grid-cols-5 gap-1">
                  <button type="button" disabled={editHistory.length === 0} onClick={handleUndoEdit} className="flex min-h-12 touch-manipulation flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-medium text-[#5c4030] disabled:opacity-35" aria-label="撤销">
                    <span className="text-base leading-none">↶</span>
                    撤销
                  </button>
                  <button type="button" onClick={() => { setCanvasToolMode('select'); setCropRect(null); handleClearCellSelection(); }} className="flex min-h-12 touch-manipulation flex-col items-center justify-center gap-0.5 rounded-xl bg-[#f3e6d4] text-[11px] font-medium text-[#5c4030]" aria-label="选区">
                    <span className="text-base leading-none">▧</span>
                    选区
                  </button>
                  <button type="button" disabled={selectedCells.size === 0} onClick={handleOpenSelectionRecolor} className="flex min-h-12 touch-manipulation flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-medium text-[#5c4030] disabled:opacity-35" aria-label="改色">
                    <span className="text-base leading-none">◈</span>
                    改色{selectedCells.size > 0 ? ` ${selectedCells.size}` : ''}
                  </button>
                  <button type="button" onClick={() => setMobileSettingsOpen(true)} className="flex min-h-12 touch-manipulation flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-medium text-[#5c4030]" aria-label="调整">
                    <span className="text-base leading-none">⚙</span>
                    调整
                  </button>
                  <button type="button" onClick={() => setMobileMoreOpen(true)} className="flex min-h-12 touch-manipulation flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-medium text-[#5c4030]" aria-label="更多">
                    <span className="text-base leading-none">⋯</span>
                    更多
                  </button>
                </WorkbenchMobileFooter>

                </div>

                {/* 颜色统计：点击选中该色号全部格子 */}
                {originalImageSrc && colorCounts && Object.keys(colorCounts).length > 0 && (
                  <WorkbenchDesktopOnly>
                    <EditorColorStatsPanel
                      colorCounts={colorCounts}
                      totalBeadCount={totalBeadCount}
                      selectedColorSystem={selectedColorSystem}
                      highlightColorKey={highlightColorKey}
                      onSelectAllByColor={handleSelectAllByColor}
                    />
                  </WorkbenchDesktopOnly>
                )}
              </div>

            </div>
          </section>
        </WorkbenchSplit>

         {/* Tooltip Display (Needs update in GridTooltip.tsx) */}
         {tooltipData && (
            <GridTooltip tooltipData={tooltipData} selectedColorSystem={selectedColorSystem} />
          )}

      </main>

      {mobileSettingsOpen ? (
        <Overlay
          labelledBy="editor-mobile-settings-title"
          placement="sheet"
          onClose={() => setMobileSettingsOpen(false)}
          panelClassName="max-h-[85vh]"
        >
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="flex shrink-0 items-center justify-between border-b border-[#eadfce] px-4 py-3">
              <h2 id="editor-mobile-settings-title" className="text-base font-semibold text-[#3a2416]">
                编辑设置
              </h2>
              <button
                type="button"
                onClick={() => setMobileSettingsOpen(false)}
                className="inline-flex h-11 min-w-11 touch-manipulation items-center justify-center rounded-xl text-sm text-[#8a6a4a]"
              >
                关闭
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-3 py-3">
              <EditorUploadPanel
                originalImageSrc={originalImageSrc}
                preAiImageSrc={preAiImageSrc}
                stagedUploadSrc={stagedUploadSrc}
                pendingPrepImageSrc={pendingPrepImageSrc}
                isImagePrepOpen={isImagePrepOpen}
                isMounted={isMounted}
                hasPatternGrid={Boolean(mappedPixelData?.length && gridDimensions && gridDimensions.N > 0)}
                onStartUploadModeProcess={() => {
                  setMobileSettingsOpen(false);
                  startUploadModeProcess();
                }}
                isRecognizingPattern={isRecognizingPattern}
                onUndoAiMatting={handleUndoAiMatting}
                onTriggerFileInput={triggerFileInput}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
              />
              <EditorSettingsPanel
                mappedPixelData={mappedPixelData}
                gridDimensions={gridDimensions}
                selectedColorSystem={selectedColorSystem}
                onSelectedColorSystemChange={setSelectedColorSystem}
                keepAspectRatio={keepAspectRatio}
                onKeepAspectRatioChange={setKeepAspectRatio}
                granularityInput={granularityInput}
                gridHeightInput={gridHeightInput}
                onGranularityInputChange={handleGranularityInputChange}
                onGridHeightInputChange={handleGridHeightInputChange}
                onApplyGridWidth={applyGridWidth}
                onApplyGridHeight={applyGridHeight}
                maxColorCount={maxColorCount}
                onMaxColorCountChange={setMaxColorCount}
                autoRemoveWhiteBg={autoRemoveWhiteBg}
                onAutoRemoveWhiteBgChange={setAutoRemoveWhiteBg}
                similarityThresholdInput={similarityThresholdInput}
                onSimilarityThresholdInputChange={handleSimilarityThresholdInputChange}
                onApplySimilarity={flushSimilarity}
                creativePreset={creativePreset}
                onCreativePresetChange={handleCreativePresetChange}
                ditheringEnabled={ditheringEnabled}
                onDitheringChange={handleDitheringChange}
                imageContrast={imageContrast}
                onImageContrastChange={setImageContrast}
                imageSaturation={imageSaturation}
                onImageSaturationChange={setImageSaturation}
                pixelationMode={pixelationMode}
                onPixelationModeChange={handlePixelationModeChange}
                customPaletteSelections={customPaletteSelections}
                onManagePalette={() => setIsPaletteOpen(true)}
                onAutoRemoveBackground={handleAutoRemoveBackground}
                onUndoBgRemoval={handleUndoBgRemoval}
                bgRemovalSnapshot={bgRemovalSnapshot}
                gridManuallyEdited={gridManuallyEdited}
                sizePending={sizePending}
                onScaleGrid={scaleGridToInputs}
                onRegenerateFromOriginal={regenerateFromOriginal}
              />
              <button
                type="button"
                disabled={!mappedPixelData}
                onClick={() => {
                  handleAutoCrop();
                  setMobileSettingsOpen(false);
                }}
                className="app-btn app-btn--secondary app-btn--block app-btn--md"
              >
                自动裁边
              </button>
            </div>
          </div>
        </Overlay>
      ) : null}

      {mobileMoreOpen ? (
        <Overlay
          labelledBy="editor-mobile-more-title"
          placement="sheet"
          onClose={() => setMobileMoreOpen(false)}
          panelClassName="max-h-[60vh]"
        >
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="flex shrink-0 items-center justify-between border-b border-[#eadfce] px-4 py-3">
              <h2 id="editor-mobile-more-title" className="text-base font-semibold text-[#3a2416]">更多操作</h2>
              <button type="button" onClick={() => setMobileMoreOpen(false)} className="inline-flex h-11 min-w-11 touch-manipulation items-center justify-center rounded-xl text-sm text-[#8a6a4a]">关闭</button>
            </div>
            <div className="grid grid-cols-2 gap-2 overflow-y-auto px-4 py-4">
              <button type="button" onClick={() => { setMobileMoreOpen(false); triggerFileInput(); }} className="min-h-12 rounded-xl border border-[#e0d0bc] bg-white text-sm font-medium text-[#5c4030]">上传图片</button>
              <button type="button" disabled={!mappedPixelData} onClick={() => { handleAutoCrop(); setMobileMoreOpen(false); }} className="min-h-12 rounded-xl border border-[#e0d0bc] bg-white text-sm font-medium text-[#5c4030] disabled:opacity-40">自动裁边</button>
              <button type="button" disabled={!mappedPixelData} onClick={() => { setCanvasToolMode('crop'); setMobileMoreOpen(false); }} className="min-h-12 rounded-xl border border-[#e0d0bc] bg-white text-sm font-medium text-[#5c4030] disabled:opacity-40">矩形裁剪</button>
              <button type="button" disabled={!mappedPixelData} onClick={() => { setMobileMoreOpen(false); setIsDownloadSettingsOpen(true); }} className="min-h-12 rounded-xl border border-[#e0d0bc] bg-white text-sm font-medium text-[#5c4030] disabled:opacity-40">导出图纸</button>
              <button type="button" onClick={() => { setMobileMoreOpen(false); if (currentPatternId) handleSavePattern(); else setIsPatternInfoOpen(true); }} className="min-h-12 rounded-xl border border-[#e0d0bc] bg-white text-sm font-medium text-[#5c4030]">保存图纸</button>
              <button type="button" onClick={() => { setMobileMoreOpen(false); handleStartBeading(); }} className="min-h-12 rounded-xl bg-[#c47a2c] text-sm font-semibold text-white">开始拼豆</button>
            </div>
          </div>
        </Overlay>
      ) : null}

      {/* 上传后处理弹窗：内选「图片转像素 / 图纸识别」 */}
      {isImagePrepOpen && pendingPrepImageSrc && (
        <ImagePrepModal
          imageSrc={pendingPrepImageSrc}
          uploadMode={uploadMode}
          onUploadModeChange={setUploadMode}
          initialSettings={{
            gridWidth: granularity,
            gridHeight,
            keepAspectRatio,
            maxColorCount,
            selectedColorSystem,
            ditheringEnabled,
            pixelationMode,
          }}
          onCancel={handlePrepCancel}
          onConfirm={async (preparedDataUrl, meta) => {
            clearStagedUpload();
            applyImagePrepConfirmToStore(meta);
            if (meta.mode === 'recognize') {
              await handleRecognizeRegionConfirm(preparedDataUrl, {
                cols: meta.gridWidth,
                rows: meta.gridHeight,
                maxColors: meta.maxColorCount,
                preferAutoGrid: meta.preferAutoGrid,
              });
              handlePrepCancel();
              return;
            }
            handlePrepConfirm(preparedDataUrl, meta);
          }}
        />
      )}

      <DownloadSettingsModal
        isOpen={isDownloadSettingsOpen}
        onClose={closeExportDialog}
        options={downloadOptions}
        onOptionsChange={setDownloadOptions}
        onDownload={handleConfirmExportDownload}
        previewUrl={exportPreviewUrl}
        previewLoading={isExportPreviewLoading}
        onPreview={handlePreviewExport}
      />

      {isIngredientBillOpen && ingredientBill && (
        <IngredientBillModal bill={ingredientBill} onClose={() => setIsIngredientBillOpen(false)} />
      )}

      <PaletteManageModal open={isPaletteOpen} onClose={() => setIsPaletteOpen(false)} />

      {/* 统一改色板 */}
      {showSelectionRecolor && selectedCells.size > 0 && (
        <SelectionRecolorModal
          selectedCount={selectedCells.size}
          allColors={fullBeadPalette}
          usedColors={currentGridColors}
          selectedColorSystem={selectedColorSystem}
          onPick={handleApplyColorToSelection}
          onClose={() => setShowSelectionRecolor(false)}
          variant={isNarrowScreen ? 'sheet' : 'floating'}
        />
      )}

      {/* 轻量提示 Toast */}
      {(toastMessage || draftSaveHint) && (
        <div className="fixed bottom-24 left-1/2 z-[200] -translate-x-1/2 transform whitespace-nowrap rounded-lg bg-gray-800 px-4 py-2 text-sm text-white shadow-lg lg:bottom-20"
             style={{ animation: 'toastFadeInOut 2s ease-in-out', marginBottom: 'env(safe-area-inset-bottom)' }}>
          {toastMessage || draftSaveHint}
        </div>
      )}
    </WorkbenchRoot>
   </>
  );
}

/** 无 patternId 时不挂载编辑器，直接去「我的图纸」 */
function EditorEntry() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const patternId = searchParams.get('patternId');

  useEffect(() => {
    if (!patternId) {
      router.replace('/dashboard');
    }
  }, [patternId, router]);

  if (!patternId) {
    return <PageLoading label="正在前往我的图纸" />;
  }

  return <Editor />;
}

export default function Home() {
  return (
    <EnsureSession>
      <Suspense fallback={<PageLoading />}>
        <EditorEntry />
      </Suspense>
    </EnsureSession>
  );
}
