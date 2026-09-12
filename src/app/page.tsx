'use client';

import React, { useState, useRef, useEffect, useMemo, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Script from 'next/script';

// 导入像素化工具和类型
import {
  PixelationMode,
  MappedPixel,
} from '../utils/pixelation';

// 导入新的类型和组件
import { IconButton } from '../components/ui/IconButton';
import { Overlay } from '../components/ui/Overlay';
import DownloadSettingsModal from '../components/DownloadSettingsModal';

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
import CustomPaletteEditor from '../components/CustomPaletteEditor';
import { 
  loadPaletteSelections,
  presetToSelections,
  PaletteSelections,
} from '../utils/localStorageUtils';
import SelectionRecolorModal from '../components/SelectionRecolorModal';

import IngredientBillModal from '../components/IngredientBillModal';
import RequireAuth from '../components/RequireAuth';
import PatternSaveModal from '../components/PatternSaveModal';
import { useAppNavSubtitle } from '../components/shell';
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
  useCanvasViewport,
  measureCanvasPixels,
  usePixelationPipeline,
  usePatternExport,
  useCustomPaletteIO,
  useEditorCanvasTools,
  useProjectDraft,
  useCanvasInteraction,
  useImageUpload,
} from '../stores';

function Editor() {
  const searchParams = useSearchParams();
  const currentPatternId = searchParams.get('patternId') || undefined;
  const [patternName, setPatternName] = useState('未命名图纸');
  const [patternDescription, setPatternDescription] = useState('');
  const [patternVisibility, setPatternVisibility] = useState<'private' | 'public'>('private');
  const [isPatternInfoOpen, setIsPatternInfoOpen] = useState(false);
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
    setCustomPaletteSelections,
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
  } = useEditorUiViewport();

  const originalCanvasRef = useRef<HTMLCanvasElement>(null);
  const pixelatedCanvasRef = useRef<HTMLCanvasElement>(null);
  /** 裁剪/撤回后短暂抑制整图重像素化 */
  const suppressPixelateUntilRef = useRef(0);

  const { draftPixelateLockRef, draftReadyToSaveRef, draftSaveHint } = useProjectDraft({
    currentPatternId,
    suppressPixelateUntilRef,
  });

  useEffect(() => {
    if (!currentPatternId) return;
    const pattern = usePatternStore.getState().loadPattern(currentPatternId);
    if (!pattern) return;

    setPatternName(pattern.name);
    setPatternDescription(pattern.description);
    setPatternVisibility(pattern.visibility);
    useEditorStore.getState().hydrateFromPatternData(pattern.data);
    draftPixelateLockRef.current = {
      locked: true,
      granularity: pattern.data.gridDimensions.N || 50,
      gridHeight: pattern.data.gridDimensions.M || 50,
      similarityThreshold: 0,
      maxColorCount: 0,
      autoRemoveWhiteBg: false,
      pixelationMode: PixelationMode.Dominant,
      remapTrigger: 0,
    };
    draftReadyToSaveRef.current = true;
  }, [currentPatternId, draftPixelateLockRef, draftReadyToSaveRef]);

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
  const [isCustomPaletteEditorOpen, setIsCustomPaletteEditorOpen] = useState<boolean>(false);

  const canvasViewportRef = useRef<HTMLDivElement | null>(null);

  // 新增：轻量提示
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2000);
  }, []);

  const {
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
    handleGranularityInputChange,
    handleGridHeightInputChange,
    applyGridWidth,
    applyGridHeight,
    handleSimilarityThresholdInputChange,
    handleConfirmParameters,
    handlePixelationModeChange,
  } = useEditorSettings({ showToast });

  const {
    editHistory,
    bgRemovalSnapshot,
    saveEditSnapshot,
    handleUndoEdit,
    handleUndoBgRemoval,
    clearEditHistory,
    setBgRemovalSnapshot,
  } = useEditorHistory({ suppressPixelateUntilRef, showToast });

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
    importPaletteInputRef,
    handleSelectionChange,
    handleSaveCustomPalette,
    handleExportCustomPalette,
    handleImportPaletteFile,
    triggerImportPalette,
  } = useCustomPaletteIO({
    onAfterSave: () => setIsCustomPaletteEditorOpen(false),
  });

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
    clearEditHistory,
  });

  const {
    fileInputRef,
    isMounted,
    triggerFileInput,
    handleFileChange,
    handleDrop,
    handleDragOver,
  } = useImageUpload({
    openImagePrep,
    showToast,
  });

  const { handleSavePattern, handleStartBeading } = useEditorPatternActions({
    patternName,
    patternDescription,
    patternVisibility,
    currentPatternId,
    onToast: showToast,
    onSavedMetaClose: () => setIsPatternInfoOpen(false),
  });

  const { fitCanvasToViewport } = useCanvasViewport(canvasViewportRef);

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
    const newActiveBeadPalette = fullBeadPalette.filter(color => {
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

  // 初始化时从本地存储加载自定义色板选择
  useEffect(() => {
    // 尝试从localStorage加载
    const savedSelections = loadPaletteSelections();
    if (savedSelections && Object.keys(savedSelections).length > 0) {
      console.log('从localStorage加载的数据键数量:', Object.keys(savedSelections).length);
      // 验证加载的数据是否都是有效的hex值
      const allHexValues = fullBeadPalette.map(color => color.hex.toUpperCase());
      const validSelections: PaletteSelections = {};
      let hasValidData = false;
      let validCount = 0;
      let invalidCount = 0;
      
      Object.entries(savedSelections).forEach(([key, value]) => {
        // 严格验证：键必须是有效的hex格式，并且存在于调色板中
        if (/^#[0-9A-F]{6}$/i.test(key) && allHexValues.includes(key.toUpperCase())) {
          validSelections[key.toUpperCase()] = value;
          hasValidData = true;
          validCount++;
        } else {
          invalidCount++;
        }
      });
      
      console.log(`验证结果: 有效键 ${validCount} 个, 无效键 ${invalidCount} 个`);
      
      if (hasValidData) {
        setCustomPaletteSelections(validSelections);
    } else {
        console.log('所有数据都无效，清除localStorage并重新初始化');
        // 如果本地数据无效，清除localStorage并默认选择所有颜色
        localStorage.removeItem('customPerlerPaletteSelections');
        const allHexValues = fullBeadPalette.map(color => color.hex.toUpperCase());
        const initialSelections = presetToSelections(allHexValues, allHexValues);
      setCustomPaletteSelections(initialSelections);
    }
    } else {
      console.log('没有localStorage数据，默认选择所有颜色');
      // 如果没有保存的选择，默认选择所有颜色
      const allHexValues = fullBeadPalette.map(color => color.hex.toUpperCase());
      const initialSelections = presetToSelections(allHexValues, allHexValues);
      setCustomPaletteSelections(initialSelections);
    }
  }, []); // 只在组件首次加载时执行

  // Ctrl/Cmd+Z 撤销改色、裁剪等编辑
  useEffect(() => {
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
      if (!isMod) return;
      if (event.key !== 'z' && event.key !== 'Z') return;
      if (event.shiftKey) return; // 留给系统/后续 redo

      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (
        tag === 'input' ||
        tag === 'textarea' ||
        tag === 'select' ||
        target?.isContentEditable
      ) {
        return;
      }

      if (editHistory.length === 0) return;
      event.preventDefault();
      handleUndoEdit();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [editHistory.length, handleUndoEdit, showSelectionRecolor, selectedCells.size, highlightColorKey, handleClearCellSelection]);

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

    {/* 编辑工作区：顶栏由全局 AppNav 提供 */}
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <main ref={mainRef} className="relative flex h-full min-h-0 w-full flex-1 flex-col">
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-hidden lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[300px_minmax(0,1fr)] lg:gap-3">
          {/* 左侧：参数区内部滚动 */}
          <aside className="flex min-h-0 flex-col space-y-3 overflow-y-auto overscroll-contain pb-1 pr-0.5">
            <EditorUploadPanel
              originalImageSrc={originalImageSrc}
              preAiImageSrc={preAiImageSrc}
              pendingPrepImageSrc={pendingPrepImageSrc}
              isImagePrepOpen={isImagePrepOpen}
              isMounted={isMounted}
              fileInputRef={fileInputRef}
              onOpenImagePrep={openImagePrep}
              onUndoAiMatting={handleUndoAiMatting}
              onTriggerFileInput={triggerFileInput}
              onFileChange={handleFileChange}
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
              onConfirmParameters={handleConfirmParameters}
              maxColorCount={maxColorCount}
              onMaxColorCountChange={setMaxColorCount}
              autoRemoveWhiteBg={autoRemoveWhiteBg}
              onAutoRemoveWhiteBgChange={setAutoRemoveWhiteBg}
              similarityThresholdInput={similarityThresholdInput}
              onSimilarityThresholdInputChange={handleSimilarityThresholdInputChange}
              pixelationMode={pixelationMode}
              onPixelationModeChange={handlePixelationModeChange}
              customPaletteSelections={customPaletteSelections}
              onOpenCustomPaletteEditor={() => setIsCustomPaletteEditorOpen(true)}
              onAutoRemoveBackground={handleAutoRemoveBackground}
              onUndoBgRemoval={handleUndoBgRemoval}
              bgRemovalSnapshot={bgRemovalSnapshot}
            />

        {originalImageSrc && activeBeadPalette.length === 0 && (
             <div className="w-full bg-yellow-100 dark:bg-yellow-900/50 p-4 rounded-lg shadow border border-yellow-200 dark:border-yellow-800/60 text-center text-sm text-yellow-800 dark:text-yellow-300">
                 当前可用颜色过少或为空。请在色板管理中勾选颜色。
             </div>
         )}

        {originalImageSrc && mappedPixelData && (
            <div className="w-full mt-4">
              {/* 使用一个大按钮，现在所有的下载设置都通过弹窗控制 */}
              <button
                type="button"
                onClick={() => setIsDownloadSettingsOpen(true)}
                disabled={!mappedPixelData || !gridDimensions || gridDimensions.N === 0 || gridDimensions.M === 0 || activeBeadPalette.length === 0}
                className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#c47a2c] px-4 text-sm font-semibold text-white shadow-[0_8px_18px_rgba(196,122,44,0.18)] transition-[background-color,opacity,box-shadow] duration-200 hover:bg-[#b06b22] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e8b86a] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
               >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                导出图纸
              </button>
              <button
                type="button"
                onClick={() => setIsIngredientBillOpen(true)}
                disabled={!ingredientBill}
                className="mt-2 flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-[#e0d0bc] bg-white px-4 text-sm font-medium text-[#5c4030] transition-[background-color,border-color] duration-150 hover:bg-[#fff4e6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e8b86a] disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                采购清单
                {ingredientBill ? ` · ${ingredientBill.colorCount} 色` : ''}
              </button>
            </div>
        )}

          </aside>

          {/* 右侧：图纸预览，占满剩余高度 */}
          <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-[#eadfce] bg-white p-3 dark:border-gray-800 dark:bg-gray-900 sm:p-4">
              <div className="mb-2 flex shrink-0 flex-col gap-2">
                <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <h2 className="text-sm font-semibold text-[#3a2416] dark:text-gray-100">图纸预览</h2>
                    {gridDimensions && <span className="rounded-md bg-[#f3e6d4] px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-[#8a6a4a] dark:bg-gray-800 dark:text-gray-400">{gridDimensions.N} × {gridDimensions.M}</span>}
                  </div>
                  <EditorPageToolbar
                    onStartBeading={handleStartBeading}
                    onSave={() => {
                      if (currentPatternId) handleSavePattern();
                      else setIsPatternInfoOpen(true);
                    }}
                  />
                </div>
                <p className="text-[11px] text-[#a08060]">拖拽框选改色，点已选格子可取消；空白处或空格拖动可移动画布</p>
              </div>

              <canvas ref={originalCanvasRef} className="hidden"></canvas>

              {/* 画布 + 右侧色块统计 */}
              <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
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
                >
                  {originalImageSrc && (
                    <div
                      className="pointer-events-auto absolute inset-x-0 bottom-3 z-30 flex justify-center px-3"
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

                {/* 颜色统计：点击选中该色号全部格子 */}
                {originalImageSrc && colorCounts && Object.keys(colorCounts).length > 0 && (
                  <EditorColorStatsPanel
                    colorCounts={colorCounts}
                    totalBeadCount={totalBeadCount}
                    selectedColorSystem={selectedColorSystem}
                    highlightColorKey={highlightColorKey}
                    onSelectAllByColor={handleSelectAllByColor}
                  />
                )}
              </div>

            </div>
          </section>
        </div>

         {/* Tooltip Display (Needs update in GridTooltip.tsx) */}
         {tooltipData && (
            <GridTooltip tooltipData={tooltipData} selectedColorSystem={selectedColorSystem} />
          )}

      </main>

      {/* 上传后预处理弹窗：默认全选裁剪 + 可选 AI 抠图 */}
      {isImagePrepOpen && pendingPrepImageSrc && (
        <ImagePrepModal
          imageSrc={pendingPrepImageSrc}
          onCancel={handlePrepCancel}
          onConfirm={handlePrepConfirm}
        />
      )}

      {/* 自定义色板管理弹窗（提到页面根层，避免被侧栏/画布挡住） */}
      {isCustomPaletteEditorOpen && (
        <Overlay
          labelledBy="custom-palette-title"
          layer="import"
          onClose={() => setIsCustomPaletteEditorOpen(false)}
          panelClassName="max-w-4xl"
        >
          <input
            type="file"
            accept=".json"
            ref={importPaletteInputRef}
            onChange={handleImportPaletteFile}
            className="hidden"
          />
          <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
            <CustomPaletteEditor
              allColors={fullBeadPalette}
              currentSelections={customPaletteSelections}
              onSelectionChange={handleSelectionChange}
              onSaveCustomPalette={handleSaveCustomPalette}
              onClose={() => setIsCustomPaletteEditorOpen(false)}
              onExportCustomPalette={handleExportCustomPalette}
              onImportCustomPalette={triggerImportPalette}
              selectedColorSystem={selectedColorSystem}
            />
          </div>
        </Overlay>
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

      {/* 统一改色板：固定在页面左上角，不随画布平移 */}
      {showSelectionRecolor && selectedCells.size > 0 && (
        <SelectionRecolorModal
          selectedCount={selectedCells.size}
          allColors={fullBeadPalette}
          usedColors={currentGridColors}
          selectedColorSystem={selectedColorSystem}
          onPick={handleApplyColorToSelection}
          onClose={() => setShowSelectionRecolor(false)}
        />
      )}

      {/* 轻量提示 Toast */}
      {(toastMessage || draftSaveHint) && (
        <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg z-[200] text-sm whitespace-nowrap"
             style={{ animation: 'toastFadeInOut 2s ease-in-out' }}>
          {toastMessage || draftSaveHint}
        </div>
      )}
    </div>
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
    return (
      <main className="platform-page">
        <p>正在前往我的图纸...</p>
      </main>
    );
  }

  return <Editor />;
}

export default function Home() {
  return (
    <RequireAuth>
      <Suspense
        fallback={
          <main className="platform-page">
            <p>加载中...</p>
          </main>
        }
      >
        <EditorEntry />
      </Suspense>
    </RequireAuth>
  );
}
