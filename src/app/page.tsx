'use client';

import React, { useState, useRef, ChangeEvent, DragEvent, useEffect, useMemo, useCallback } from 'react';
import Script from 'next/script';

// 导入像素化工具和类型
import {
  PixelationMode,
  calculatePixelGrid,
  RgbColor,
  PaletteColor,
  MappedPixel,
  hexToRgb,
  colorDistance,
  findClosestPaletteColor
} from '../utils/pixelation';

// 导入新的类型和组件
import { GridDownloadOptions } from '../types/downloadTypes';
import { IconButton } from '../components/ui/IconButton';
import { ColorSwatch } from '../components/ui/ColorSwatch';
import { Overlay } from '../components/ui/Overlay';
import DownloadSettingsModal, { gridLineColorOptions } from '../components/DownloadSettingsModal';
import { downloadImage, exportCsvData, importCsvData } from '../utils/imageDownloader';

import { 
  colorSystemOptions, 
  convertPaletteToColorSystem, 
  getColorKeyByHex,
  getMardToHexMapping,
  sortColorsByHue,
  ColorSystem 
} from '../utils/colorSystemUtils';

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

// Helper function for sorting color keys - 保留原有实现，因为未在utils中导出
function sortColorKeys(a: string, b: string): number {
  const regex = /^([A-Z]+)(\d+)$/;
  const matchA = a.match(regex);
  const matchB = b.match(regex);

  if (matchA && matchB) {
    const prefixA = matchA[1];
    const numA = parseInt(matchA[2], 10);
    const prefixB = matchB[1];
    const numB = parseInt(matchB[2], 10);

    if (prefixA !== prefixB) {
      return prefixA.localeCompare(prefixB); // Sort by prefix first (A, B, C...)
    }
    return numA - numB; // Then sort by number (1, 2, 10...)
  }
  // Fallback for keys that don't match the standard pattern (e.g., T1, ZG1)
  return a.localeCompare(b);
}

// --- Define available palette key sets ---
// 从colorSystemMapping.json获取所有MARD色号
const mardToHexMapping = getMardToHexMapping();

// Pre-process the FULL palette data once - 使用colorSystemMapping而不是beadPaletteData
const fullBeadPalette: PaletteColor[] = Object.entries(mardToHexMapping)
  .map(([mardKey, hex]) => {
    const rgb = hexToRgb(hex);
    if (!rgb) {
      console.warn(`Invalid hex code "${hex}" for MARD key "${mardKey}". Skipping.`);
      return null;
    }
    // 使用hex值作为key，符合新的架构设计
    return { key: hex, hex, rgb };
  })
  .filter((color): color is PaletteColor => color !== null);

// ++ Add definition for background color keys ++

// 1. 导入新组件
import PixelatedPreviewCanvas, {
  cellKey,
  CanvasToolMode,
  CropRect,
} from '../components/PixelatedPreviewCanvas';
import ImagePrepModal from '../components/ImagePrepModal';
import GridTooltip from '../components/GridTooltip';
import CustomPaletteEditor from '../components/CustomPaletteEditor';
import {
  loadPaletteSelections,
  savePaletteSelections,
  presetToSelections,
  PaletteSelections,
  saveProjectDraft,
  loadProjectDraft,
} from '../utils/localStorageUtils';
import { TRANSPARENT_KEY, transparentColorData } from '../utils/pixelEditingUtils';
import { limitColorCount, removeEdgeBackground, recountColors, cropPixelGrid, autoCropPixelGrid } from '../utils/colorLimitUtils';
import SelectionRecolorModal from '../components/SelectionRecolorModal';

import FocusModePreDownloadModal from '../components/FocusModePreDownloadModal';
import IngredientBillModal from '../components/IngredientBillModal';
import { generateIngredientBill, IngredientBill } from '../utils/ingredientEngine';

export default function Home() {
  const [originalImageSrc, setOriginalImageSrc] = useState<string | null>(null);
  const [granularity, setGranularity] = useState<number>(50); // 网格宽
  const [granularityInput, setGranularityInput] = useState<string>("50");
  const [gridHeight, setGridHeight] = useState<number>(50); // 网格高
  const [gridHeightInput, setGridHeightInput] = useState<string>("50");
  const [keepAspectRatio, setKeepAspectRatio] = useState<boolean>(true);
  const [imageAspectRatio, setImageAspectRatio] = useState<number>(1); // height/width
  const [similarityThreshold, setSimilarityThreshold] = useState<number>(0);
  const [similarityThresholdInput, setSimilarityThresholdInput] = useState<string>("0");
  // 精简拼豆种类：0 = 无限制
  const [maxColorCount, setMaxColorCount] = useState<number>(0);
  // 自动去除白底
  const [autoRemoveWhiteBg, setAutoRemoveWhiteBg] = useState<boolean>(false);
  // 添加像素化模式状态
  const [pixelationMode, setPixelationMode] = useState<PixelationMode>(PixelationMode.Dominant); // 默认为卡通模式
  
  // 新增：色号系统选择状态
  const [selectedColorSystem, setSelectedColorSystem] = useState<ColorSystem>('MARD');
  
  const [activeBeadPalette, setActiveBeadPalette] = useState<PaletteColor[]>(() => {
      return fullBeadPalette; // 默认使用全部颜色
  });
  // 状态变量：存储被排除的颜色（hex值）
  const [excludedColorKeys, setExcludedColorKeys] = useState<Set<string>>(new Set());
  // 用于记录初始网格颜色（hex值），用于显示排除功能
  const [initialGridColorKeys, setInitialGridColorKeys] = useState<Set<string>>(new Set());
  const [mappedPixelData, setMappedPixelData] = useState<MappedPixel[][] | null>(null);
  const [gridDimensions, setGridDimensions] = useState<{ N: number; M: number } | null>(null);
  const [colorCounts, setColorCounts] = useState<{ [key: string]: { count: number; color: string } } | null>(null);
  const [totalBeadCount, setTotalBeadCount] = useState<number>(0);
  const [tooltipData, setTooltipData] = useState<{ x: number, y: number, key: string, color: string } | null>(null);
  const [remapTrigger, setRemapTrigger] = useState<number>(0);
  const [isManualColoringMode, setIsManualColoringMode] = useState<boolean>(false);
  const [selectedColor, setSelectedColor] = useState<MappedPixel | null>(null);
  // 新增：一键擦除模式状态
  const [isEraseMode, setIsEraseMode] = useState<boolean>(false);
  const [customPaletteSelections, setCustomPaletteSelections] = useState<PaletteSelections>({});
  const [isCustomPaletteEditorOpen, setIsCustomPaletteEditorOpen] = useState<boolean>(false);
  
  // ++ 新增：下载设置相关状态 ++
  const [isDownloadSettingsOpen, setIsDownloadSettingsOpen] = useState<boolean>(false);
  const [exportPreviewUrl, setExportPreviewUrl] = useState<string | null>(null);
  const [exportPreviewFilename, setExportPreviewFilename] = useState('');
  const [isExportPreviewLoading, setIsExportPreviewLoading] = useState(false);
  const [downloadOptions, setDownloadOptions] = useState<GridDownloadOptions>({
    showGrid: true,
    gridInterval: 10,
    showCoordinates: true,
    showCellNumbers: true,
    gridLineColor: gridLineColorOptions[0].value,
    includeStats: true, // 默认包含统计信息
    exportCsv: false // 默认不导出CSV
  });

  // 新增：高亮相关状态
  const [highlightColorKey, setHighlightColorKey] = useState<string | null>(null);

  // 预览缩放（1 = 100%）
  const [previewZoom, setPreviewZoom] = useState<number>(1);
  const [canvasOffset, setCanvasOffset] = useState({ x: 16, y: 16 });
  const canvasPanRef = useRef<{ x: number; y: number; pointerId: number } | null>(null);
  const spaceHeldRef = useRef(false);

  // 画布：外面直接框选改色 / 裁剪
  const [canvasToolMode, setCanvasToolMode] = useState<CanvasToolMode>('select');
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
  const [cropRect, setCropRect] = useState<CropRect | null>(null);
  const [showSelectionRecolor, setShowSelectionRecolor] = useState(false);

  // 上传后预处理弹窗（裁剪 + 可选 AI 抠图）
  const [pendingPrepImageSrc, setPendingPrepImageSrc] = useState<string | null>(null);
  const [isImagePrepOpen, setIsImagePrepOpen] = useState(false);
  const [preAiImageSrc, setPreAiImageSrc] = useState<string | null>(null);
  
  // 新增：颜色替换相关状态
  const [colorReplaceState, setColorReplaceState] = useState<{
    isActive: boolean;
    step: 'select-source' | 'select-target';
    sourceColor?: { key: string; color: string };
  }>({
    isActive: false,
    step: 'select-source'
  });

  // 新增：组件挂载状态
  const [isMounted, setIsMounted] = useState<boolean>(false);

  // 新增：专心拼豆模式进入前下载提醒弹窗
  const [isFocusModePreDownloadModalOpen, setIsFocusModePreDownloadModalOpen] = useState<boolean>(false);
  const [isIngredientBillOpen, setIsIngredientBillOpen] = useState(false);

  // 新增：横屏设备弹窗状态
  // 新增：编辑撤回历史栈（多步）
  interface EditSnapshot {
    mappedPixelData: MappedPixel[][];
    colorCounts: { [key: string]: { count: number; color: string } };
    totalBeadCount: number;
    gridDimensions: { N: number; M: number } | null;
    granularity: number;
    gridHeight: number;
  }
  const [editHistory, setEditHistory] = useState<EditSnapshot[]>([]);

  // 新增：一键去背景撤回快照（单步）
  const [bgRemovalSnapshot, setBgRemovalSnapshot] = useState<EditSnapshot | null>(null);

  // 新增：轻量提示
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2000);
  }, []);

  // --- 撤回功能 ---

  // 保存编辑快照到历史栈
  const saveEditSnapshot = useCallback(() => {
    if (!mappedPixelData || !colorCounts) return;
    const snapshot: EditSnapshot = {
      mappedPixelData: mappedPixelData.map(row => row.map(cell => ({ ...cell }))),
      colorCounts: { ...colorCounts },
      totalBeadCount,
      gridDimensions: gridDimensions ? { ...gridDimensions } : null,
      granularity,
      gridHeight,
    };
    setEditHistory(prev => [...prev.slice(-49), snapshot]);
  }, [mappedPixelData, colorCounts, totalBeadCount, gridDimensions, granularity, gridHeight]);

  // 编辑模式多步撤回
  const handleUndoEdit = useCallback(() => {
    if (editHistory.length === 0) return;
    const snapshot = editHistory[editHistory.length - 1];
    // 撤回裁剪/改尺寸时避免触发整图重像素化
    suppressPixelateUntilRef.current = Date.now() + 400;
    setMappedPixelData(snapshot.mappedPixelData);
    setColorCounts(snapshot.colorCounts);
    setTotalBeadCount(snapshot.totalBeadCount);
    if (snapshot.gridDimensions) {
      setGridDimensions(snapshot.gridDimensions);
      setGranularity(snapshot.granularity);
      setGridHeight(snapshot.gridHeight);
      setGranularityInput(String(snapshot.granularity));
      setGridHeightInput(String(snapshot.gridHeight));
    }
    setEditHistory(prev => prev.slice(0, -1));
    setSelectedCells(new Set());
    setShowSelectionRecolor(false);
    showToast('已撤回上一步');
  }, [editHistory, showToast]);

  // 一键去背景单步撤回
  const handleUndoBgRemoval = useCallback(() => {
    if (!bgRemovalSnapshot) return;
    setMappedPixelData(bgRemovalSnapshot.mappedPixelData);
    setColorCounts(bgRemovalSnapshot.colorCounts);
    setTotalBeadCount(bgRemovalSnapshot.totalBeadCount);
    setBgRemovalSnapshot(null);
    showToast('已撤回背景去除');
  }, [bgRemovalSnapshot, showToast]);

  // 清空编辑历史（参数变化、退出编辑模式等时调用）
  const clearEditHistory = useCallback(() => {
    setEditHistory([]);
  }, []);

  // 预览画布：多选格子后统一改色
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
  }, []);

  const handleClearCellSelection = useCallback(() => {
    setSelectedCells(new Set());
    setShowSelectionRecolor(false);
    setHighlightColorKey(null);
  }, []);

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
  }, [mappedPixelData, gridDimensions, selectedCells, saveEditSnapshot]);

  const handleOpenSelectionRecolor = useCallback(() => {
    if (selectedCells.size > 0) {
      setShowSelectionRecolor(true);
    }
  }, [selectedCells.size]);

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
  }, [mappedPixelData, gridDimensions, selectedCells, handleClearCellSelection]);

  // 裁剪只切格子数据；短暂抑制整图重像素化（避免变成「缩小」）
  const suppressPixelateUntilRef = useRef(0);
  /** 草稿恢复后锁定自动重像素化，直到用户改参数/触发 remap */
  const draftPixelateLockRef = useRef<{
    locked: boolean;
    granularity: number;
    gridHeight: number;
    similarityThreshold: number;
    maxColorCount: number;
    autoRemoveWhiteBg: boolean;
    pixelationMode: string;
    remapTrigger: number;
  } | null>(null);
  const draftReadyToSaveRef = useRef(false);
  const [draftSaveHint, setDraftSaveHint] = useState<string | null>(null);

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
  }, [mappedPixelData, saveEditSnapshot, handleClearCellSelection]);

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
  }, [mappedPixelData, gridDimensions, selectedColor, colorCounts, totalBeadCount, saveEditSnapshot]);

  const originalCanvasRef = useRef<HTMLCanvasElement>(null);
  const pixelatedCanvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // ++ 添加: Ref for import file input ++
  const importPaletteInputRef = useRef<HTMLInputElement>(null);
  //const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  // ++ Re-add touch refs needed for tooltip logic ++
  //const touchStartPosRef = useRef<{ x: number; y: number; pageX: number; pageY: number } | null>(null);
  //const touchMovedRef = useRef<boolean>(false);

  // ++ Add a ref for the main element ++
  const mainRef = useRef<HTMLElement>(null);

  // --- Derived State ---

  // Update active palette based on selection and exclusions
  useEffect(() => {
    const newActiveBeadPalette = fullBeadPalette.filter(color => {
      const normalizedHex = color.hex.toUpperCase();
      const isSelectedInCustomPalette = customPaletteSelections[normalizedHex];
      const isNotExcluded = !excludedColorKeys.has(normalizedHex);
      return isSelectedInCustomPalette && isNotExcluded;
    });
    // 根据选择的色号系统转换调色板
    const convertedPalette = convertPaletteToColorSystem(newActiveBeadPalette, selectedColorSystem);
    setActiveBeadPalette(convertedPalette);
  }, [customPaletteSelections, excludedColorKeys, remapTrigger, selectedColorSystem]);

  // ++ 添加：当状态变化时同步更新输入框的值 ++
  useEffect(() => {
    setGranularityInput(granularity.toString());
    setGridHeightInput(gridHeight.toString());
    setSimilarityThresholdInput(similarityThreshold.toString());
  }, [granularity, gridHeight, similarityThreshold]);

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

  // 更新 activeBeadPalette 基于自定义选择和排除列表
  useEffect(() => {
    const newActiveBeadPalette = fullBeadPalette.filter(color => {
      const normalizedHex = color.hex.toUpperCase();
      const isSelectedInCustomPalette = customPaletteSelections[normalizedHex];
      // 使用hex值进行排除检查
      const isNotExcluded = !excludedColorKeys.has(normalizedHex);
      return isSelectedInCustomPalette && isNotExcluded;
    });
    // 不进行色号系统转换，保持原始的MARD色号和hex值
    setActiveBeadPalette(newActiveBeadPalette);
  }, [customPaletteSelections, excludedColorKeys, remapTrigger]);

  // --- Event Handlers ---

  const handleProceedToFocusMode = () => {
    // 保存数据到localStorage供专心拼豆模式使用
    localStorage.setItem('focusMode_pixelData', JSON.stringify(mappedPixelData));
    localStorage.setItem('focusMode_gridDimensions', JSON.stringify(gridDimensions));
    localStorage.setItem('focusMode_colorCounts', JSON.stringify(colorCounts));
    localStorage.setItem('focusMode_selectedColorSystem', selectedColorSystem);
    
    // 跳转到专心拼豆页面
    window.location.href = '/focus';
  };

  // 添加一个安全的文件输入触发函数
  const triggerFileInput = useCallback(() => {
    // 检查组件是否已挂载
    if (!isMounted) {
      console.warn("组件尚未完全挂载，延迟触发文件选择");
      setTimeout(() => triggerFileInput(), 200);
      return;
    }
    
    // 检查 ref 是否存在
    if (fileInputRef.current) {
      try {
        fileInputRef.current.click();
      } catch (error) {
        console.error("触发文件选择失败:", error);
        // 如果直接点击失败，尝试延迟执行
        setTimeout(() => {
          try {
            fileInputRef.current?.click();
          } catch (retryError) {
            console.error("重试触发文件选择失败:", retryError);
          }
        }, 100);
      }
    } else {
      // 如果 ref 不存在，延迟重试
      console.warn("文件输入引用不存在，将在100ms后重试");
      setTimeout(() => {
        if (fileInputRef.current) {
          try {
            fileInputRef.current.click();
          } catch (error) {
            console.error("延迟触发文件选择失败:", error);
          }
        }
      }, 100);
    }
  }, [isMounted]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // 检查文件类型是否支持
      const fileName = file.name.toLowerCase();
      const fileType = file.type.toLowerCase();
      
      // 支持的图片类型
      const supportedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
      // 支持的CSV MIME类型（不同浏览器可能返回不同的MIME类型）
      const supportedCsvTypes = ['text/csv', 'application/csv', 'text/plain'];

      const isImageFile = supportedImageTypes.includes(fileType) || fileType.startsWith('image/');
      const isCsvFile = supportedCsvTypes.includes(fileType) || fileName.endsWith('.csv');

      if (isImageFile || isCsvFile) {
        setExcludedColorKeys(new Set()); // ++ 重置排除列表 ++
        processFile(file);
      } else {
        alert(`不支持的文件类型: ${file.type || '未知'}。请选择 JPG、PNG、GIF 格式的图片文件，或 CSV 数据文件。\n文件名: ${file.name}`);
        console.warn(`Unsupported file type: ${file.type}, file name: ${file.name}`);
      }
    }
    // 重置文件输入框的值，这样用户可以重新选择同一个文件
    if (event.target) {
      event.target.value = '';
    }
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    
    try {
      if (event.dataTransfer.files && event.dataTransfer.files[0]) {
        const file = event.dataTransfer.files[0];
        
        // 使用与handleFileChange相同的文件类型检查逻辑
        const fileName = file.name.toLowerCase();
        const fileType = file.type.toLowerCase();
        
        // 支持的图片类型
        const supportedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
        // 支持的CSV MIME类型（不同浏览器可能返回不同的MIME类型）
        const supportedCsvTypes = ['text/csv', 'application/csv', 'text/plain'];

        const isImageFile = supportedImageTypes.includes(fileType) || fileType.startsWith('image/');
        const isCsvFile = supportedCsvTypes.includes(fileType) || fileName.endsWith('.csv');

        if (isImageFile || isCsvFile) {
          setExcludedColorKeys(new Set()); // ++ 重置排除列表 ++
          processFile(file);
        } else {
          alert(`不支持的文件类型: ${file.type || '未知'}。请拖放 JPG、PNG、GIF 格式的图片文件，或 CSV 数据文件。\n文件名: ${file.name}`);
          console.warn(`Unsupported file type: ${file.type}, file name: ${file.name}`);
        }
      }
    } catch (error) {
      console.error("处理拖拽文件时发生错误:", error);
      alert("处理文件时发生错误，请重试。");
    }
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };

  // 根据mappedPixelData生成合成的originalImageSrc
  const generateSyntheticImageFromPixelData = (pixelData: MappedPixel[][], dimensions: { N: number; M: number }): string => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      console.error('无法创建canvas上下文');
      return '';
    }
    
    // 设置画布尺寸，每个像素用8x8像素来表示以确保清晰度
    const pixelSize = 8;
    canvas.width = dimensions.N * pixelSize;
    canvas.height = dimensions.M * pixelSize;
    
    // 绘制每个像素
    pixelData.forEach((row, rowIndex) => {
      row.forEach((cell, colIndex) => {
        if (cell) {
          // 使用颜色，外部单元格用白色
          const color = cell.isExternal ? '#FFFFFF' : cell.color;
          ctx.fillStyle = color;
          ctx.fillRect(
            colIndex * pixelSize, 
            rowIndex * pixelSize, 
            pixelSize, 
            pixelSize
          );
        }
      });
    });
    
    // 转换为dataURL
    return canvas.toDataURL('image/png');
  };

  // 启动时恢复上次图纸草稿（改色等会自动写回浏览器）
  useEffect(() => {
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
  }, []);

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

  const processFile = (file: File) => {
    // 检查文件类型
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    
    if (fileExtension === 'csv') {
      // 处理CSV文件
      console.log('正在导入CSV文件...');
      importCsvData(file)
        .then(({ mappedPixelData, gridDimensions }) => {
          console.log(`成功导入CSV文件: ${gridDimensions.N}x${gridDimensions.M}`);
          
          // 设置导入的数据
          setMappedPixelData(mappedPixelData);
          setGridDimensions(gridDimensions);
          setOriginalImageSrc(null); // CSV导入时没有原始图片
          
          // 计算颜色统计
          const colorCountsMap: { [key: string]: { count: number; color: string } } = {};
          let totalCount = 0;
          
          mappedPixelData.forEach(row => {
            row.forEach(cell => {
              if (cell && !cell.isExternal) {
                const colorKey = cell.color.toUpperCase();
                if (colorCountsMap[colorKey]) {
                  colorCountsMap[colorKey].count++;
                } else {
                  colorCountsMap[colorKey] = {
                    count: 1,
                    color: cell.color
                  };
                }
                totalCount++;
              }
            });
          });
          
          setColorCounts(colorCountsMap);
          setTotalBeadCount(totalCount);
          setInitialGridColorKeys(new Set(Object.keys(colorCountsMap)));
          
          // 根据mappedPixelData生成合成的originalImageSrc
          const syntheticImageSrc = generateSyntheticImageFromPixelData(mappedPixelData, gridDimensions);
          
          setOriginalImageSrc(syntheticImageSrc);
          
          // 重置状态
          setIsManualColoringMode(false);
          setSelectedColor(null);
          setIsEraseMode(false);
          
          // 设置格子数量为导入的尺寸，避免重新映射时尺寸被修改
          setGranularity(gridDimensions.N);
          setGranularityInput(gridDimensions.N.toString());
          
          alert(`成功导入CSV文件！图纸尺寸：${gridDimensions.N}x${gridDimensions.M}，共使用${Object.keys(colorCountsMap).length}种颜色。`);
        })
        .catch(error => {
          console.error('CSV导入失败:', error);
          alert(`CSV导入失败：${error.message}`);
        });
    } else {
      // 处理图片文件
      const applyImageSrc = (result: string) => {
        setMappedPixelData(null);
        setGridDimensions(null);
        setColorCounts(null);
        setTotalBeadCount(0);
        setInitialGridColorKeys(new Set());
        setPreviewZoom(1);
        setSelectedColor(null);
        setPreAiImageSrc(null);
        setOriginalImageSrc(null);
        // 上传后先弹出预处理（默认全选裁剪，可选 AI 抠图）
        openImagePrep(result);
      };

      const isGif = file.type === 'image/gif' || file.name.toLowerCase().endsWith('.gif');

      if (isGif) {
        // GIF 走 createImageBitmap，规范保证返回首帧（default image），再烘焙为 PNG dataURL
        createImageBitmap(file)
          .then((bitmap) => {
            const canvas = document.createElement('canvas');
            canvas.width = bitmap.width;
            canvas.height = bitmap.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('无法创建 Canvas 上下文');
            ctx.drawImage(bitmap, 0, 0);
            bitmap.close();
            applyImageSrc(canvas.toDataURL('image/png'));
          })
          .catch((error) => {
            console.error('GIF 处理失败:', error);
            alert('无法读取 GIF 文件。');
            setInitialGridColorKeys(new Set());
          });
      } else {
        const reader = new FileReader();
        reader.onload = (e) => {
          applyImageSrc(e.target?.result as string);
        };
        reader.onerror = () => {
          console.error("文件读取失败");
          alert("无法读取文件。");
          setInitialGridColorKeys(new Set()); // ++ 重置初始键 ++
        };
        reader.readAsDataURL(file);
      }
      // ++ Reset manual coloring mode when a new file is processed ++
      setIsManualColoringMode(false);
      setSelectedColor(null);
      setIsEraseMode(false);
    }
  };

  // ++ 新增：处理输入框变化的函数 ++
  const handleGranularityInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    setGranularityInput(event.target.value);
  };

  const handleGridHeightInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    setGridHeightInput(event.target.value);
  };

  const clampGridSize = (value: number) => Math.max(10, Math.min(300, value));

  const applyGridWidth = (rawWidth: number, commit = true) => {
    const width = clampGridSize(rawWidth);
    let height = gridHeight;
    if (keepAspectRatio && imageAspectRatio > 0) {
      height = clampGridSize(Math.round(width * imageAspectRatio));
    }
    if (commit) {
      setGranularity(width);
      setGridHeight(height);
      setRemapTrigger((prev) => prev + 1);
      setIsManualColoringMode(false);
      setSelectedColor(null);
    }
    setGranularityInput(width.toString());
    setGridHeightInput(height.toString());
    return { width, height };
  };

  const applyGridHeight = (rawHeight: number, commit = true) => {
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
      setIsManualColoringMode(false);
      setSelectedColor(null);
    }
    setGranularityInput(width.toString());
    setGridHeightInput(height.toString());
    return { width, height };
  };

  // ++ 添加：处理相似度输入框变化的函数 ++
  const handleSimilarityThresholdInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSimilarityThresholdInput(event.target.value);
  };

  // ++ 修改：处理确认按钮点击的函数，同时处理两个参数 ++
  const handleConfirmParameters = () => {
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
      setIsManualColoringMode(false);
      setSelectedColor(null);
    }

    setGranularityInput(width.toString());
    setGridHeightInput(height.toString());
    setSimilarityThresholdInput(newSimilarity.toString());
    showToast(`已应用 ${width} × ${height} 网格`);
  };

  // 添加像素化模式切换处理函数
  const handlePixelationModeChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const newMode = event.target.value as PixelationMode;
    if (Object.values(PixelationMode).includes(newMode)) {
        setPixelationMode(newMode);
        setRemapTrigger(prev => prev + 1); // 触发重新映射
        setIsManualColoringMode(false); // 退出手动模式
        setSelectedColor(null);
    } else {
        console.warn(`无效的像素化模式: ${newMode}`);
    }
  };

  // 修改pixelateImage函数接收宽高、限色、去白底参数
  const pixelateImage = (
    imageSrc: string,
    gridW: number,
    gridH: number,
    threshold: number,
    currentPalette: PaletteColor[],
    mode: PixelationMode,
    colorLimit: number,
    doAutoRemoveBg: boolean
  ) => {
    console.log(`Attempting to pixelate with size: ${gridW}x${gridH}, threshold: ${threshold}, mode: ${mode}, colorLimit: ${colorLimit}`);
    const originalCanvas = originalCanvasRef.current;
    const pixelatedCanvas = pixelatedCanvasRef.current;

    if (!originalCanvas || !pixelatedCanvas) { console.error("Canvas ref(s) not available."); return; }
    const originalCtx = originalCanvas.getContext('2d', { willReadFrequently: true });
    const pixelatedCtx = pixelatedCanvas.getContext('2d');
    if (!originalCtx || !pixelatedCtx) { console.error("Canvas context(s) not found."); return; }
    console.log("Canvas contexts obtained.");

    if (currentPalette.length === 0) {
        console.error("Cannot pixelate: The selected color palette is empty (likely due to exclusions).");
        alert("错误：当前可用颜色板为空（可能所有颜色都被排除了），无法处理图像。请尝试恢复部分颜色。");
        // Clear previous results visually
        pixelatedCtx.clearRect(0, 0, pixelatedCanvas.width, pixelatedCanvas.height);
        setMappedPixelData(null);
        setGridDimensions(null);
        return;
    }
    const t1FallbackColor = currentPalette.find(p => p.key === 'T1')
                         || currentPalette.find(p => p.hex.toUpperCase() === '#FFFFFF')
                         || currentPalette[0];
    console.log("Using fallback color for empty cells:", t1FallbackColor);

    const img = new window.Image();
    
    img.onerror = (error: Event | string) => {
      console.error("Image loading failed:", error); 
      alert("无法加载图片。");
      setOriginalImageSrc(null); 
      setMappedPixelData(null); 
      setGridDimensions(null); 
      setColorCounts(null); 
      setInitialGridColorKeys(new Set());
    };
    
    img.onload = () => {
      console.log("Image loaded successfully.");
      const aspectRatio = img.height / img.width;
      setImageAspectRatio(aspectRatio);

      const N = Math.max(1, gridW);
      const M = Math.max(1, gridH);
      console.log(`Grid size: ${N}x${M}`);

      // 画布显示尺寸由 PixelatedPreviewCanvas 自行管理，这里只准备原图
      originalCanvas.width = img.width;
      originalCanvas.height = img.height;
      originalCtx.drawImage(img, 0, 0, img.width, img.height);
      console.log("Original image drawn.");

      const initialMappedData = calculatePixelGrid(
          originalCtx,
          img.width,
          img.height,
          N,
          M,
          currentPalette, 
          mode,
          t1FallbackColor
      );
      console.log(`Initial data mapping complete using mode ${mode}. Starting global color merging...`);

      // --- 新的全局颜色合并逻辑 ---
      const keyToRgbMap = new Map<string, RgbColor>();
      const keyToColorDataMap = new Map<string, PaletteColor>();
      currentPalette.forEach(p => {
        keyToRgbMap.set(p.key, p.rgb);
        keyToColorDataMap.set(p.key, p);
      });

      // 2. 统计初始颜色数量
      const initialColorCounts: { [key: string]: number } = {};
      initialMappedData.flat().forEach(cell => {
          if (cell && cell.key && !cell.isExternal && cell.key !== TRANSPARENT_KEY) {
              initialColorCounts[cell.key] = (initialColorCounts[cell.key] || 0) + 1;
          }
      });
      console.log("Initial color counts:", initialColorCounts);

      // 3. 创建一个颜色排序列表，按出现频率从高到低排序
      const colorsByFrequency = Object.entries(initialColorCounts)
          .sort((a, b) => b[1] - a[1])  // 按频率降序排序
          .map(entry => entry[0]);      // 只保留颜色键
      
      if (colorsByFrequency.length === 0) {
          console.log("No non-background colors found! Skipping merging.");
      }

      console.log("Colors sorted by frequency:", colorsByFrequency);
      
      // 4. 复制初始数据，准备合并
      const mergedData: MappedPixel[][] = initialMappedData.map(row => 
          row.map(cell => ({ ...cell, isExternal: cell.isExternal ?? false }))
      );
      
      // 5. 处理相似颜色合并
      const similarityThresholdValue = threshold;
      
      // 已被合并（替换）的颜色集合
      const replacedColors = new Set<string>();
      
      // 对每个颜色按频率从高到低处理
      for (let i = 0; i < colorsByFrequency.length; i++) {
          const currentKey = colorsByFrequency[i];
          
          // 如果当前颜色已经被合并到更频繁的颜色中，跳过
          if (replacedColors.has(currentKey)) continue;
          
          const currentRgb = keyToRgbMap.get(currentKey);
          if (!currentRgb) {
              console.warn(`RGB not found for key ${currentKey}. Skipping.`);
              continue;
          }
          
          // 检查剩余的低频颜色
          for (let j = i + 1; j < colorsByFrequency.length; j++) {
              const lowerFreqKey = colorsByFrequency[j];
              
              // 如果低频颜色已被替换，跳过
              if (replacedColors.has(lowerFreqKey)) continue;
              
              const lowerFreqRgb = keyToRgbMap.get(lowerFreqKey);
              if (!lowerFreqRgb) {
                  console.warn(`RGB not found for key ${lowerFreqKey}. Skipping.`);
                  continue;
              }
              
              // 计算颜色距离
              const dist = colorDistance(currentRgb, lowerFreqRgb);
              
              // 如果距离小于阈值，将低频颜色替换为高频颜色
              if (dist < similarityThresholdValue) {
                  console.log(`Merging color ${lowerFreqKey} into ${currentKey} (Distance: ${dist.toFixed(2)})`);
                  
                  // 标记这个颜色已被替换
                  replacedColors.add(lowerFreqKey);
                  
                  // 替换所有使用这个低频颜色的单元格
                  for (let r = 0; r < M; r++) {
                      for (let c = 0; c < N; c++) {
                          if (mergedData[r][c].key === lowerFreqKey) {
                              const colorData = keyToColorDataMap.get(currentKey);
                              if (colorData) {
                                  mergedData[r][c] = {
                                      key: currentKey,
                                      color: colorData.hex,
                                      isExternal: false
                                  };
                              }
                          }
                      }
                  }
              }
          }
      }
      
      if (replacedColors.size > 0) {
          console.log(`Merged ${replacedColors.size} less frequent similar colors into more frequent ones.`);
      } else {
          console.log("No colors were similar enough to merge.");
      }
      // --- 结束新的全局颜色合并逻辑 ---

      // 精简拼豆种类
      let finalData = limitColorCount(mergedData, currentPalette, colorLimit);

      // 自动去除白底
      if (doAutoRemoveBg) {
        finalData = removeEdgeBackground(finalData, true);
      }

      // --- 绘制和状态更新 ---
      if (pixelatedCanvasRef.current) {
        setMappedPixelData(finalData);
        setGridDimensions({ N, M });

        const { counts, total } = recountColors(finalData);
        setColorCounts(counts);
        setTotalBeadCount(total);
        setInitialGridColorKeys(new Set(Object.keys(counts)));
        console.log("Color counts updated:", counts);
        console.log("Total bead count:", total);
      } else {
        console.error("Pixelated canvas ref is null, skipping draw call in pixelateImage.");
      }
    }; // 正确闭合 img.onload 函数
    
    console.log("Setting image source...");
    img.src = imageSrc;
    setIsManualColoringMode(false);
    setSelectedColor(null);
  }; // 正确闭合 pixelateImage 函数

  // 当 remapTrigger 变化时清空撤回历史（参数调整/颜色排除/新图上传等均会触发 remap）
  useEffect(() => {
    clearEditHistory();
    setBgRemovalSnapshot(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remapTrigger]);

  // 修改useEffect中的pixelateImage调用，加入模式参数
  useEffect(() => {
    // 草稿恢复锁定：参数未变时不重跑像素化，避免覆盖改色
    const lock = draftPixelateLockRef.current;
    if (lock?.locked) {
      const unchanged =
        lock.granularity === granularity &&
        lock.gridHeight === gridHeight &&
        lock.similarityThreshold === similarityThreshold &&
        lock.maxColorCount === maxColorCount &&
        lock.autoRemoveWhiteBg === autoRemoveWhiteBg &&
        lock.pixelationMode === pixelationMode &&
        lock.remapTrigger === remapTrigger;
      if (unchanged) {
        return;
      }
      draftPixelateLockRef.current = null;
    }
    // 裁剪后只同步了网格尺寸，不应把整张原图按新尺寸重新像素化（那会变成缩小而不是切图）
    if (Date.now() < suppressPixelateUntilRef.current) {
      return;
    }
    if (originalImageSrc && activeBeadPalette.length > 0) {
       const timeoutId = setTimeout(() => {
         if (Date.now() < suppressPixelateUntilRef.current) {
           return;
         }
         if (originalImageSrc && originalCanvasRef.current && pixelatedCanvasRef.current && activeBeadPalette.length > 0) {
           console.log("useEffect triggered: Processing image due to src, size, threshold, palette, mode, colorLimit or remap trigger.");
           pixelateImage(
             originalImageSrc,
             granularity,
             gridHeight,
             similarityThreshold,
             activeBeadPalette,
             pixelationMode,
             maxColorCount,
             autoRemoveWhiteBg
           );
         } else {
            console.warn("useEffect check failed inside timeout: Refs or active palette not ready/empty.");
         }
       }, 50);
       return () => clearTimeout(timeoutId);
    } else if (originalImageSrc && activeBeadPalette.length === 0) {
        console.warn("Image selected, but the active palette is empty after exclusions. Cannot process. Clearing preview.");
        const pixelatedCanvas = pixelatedCanvasRef.current;
        const pixelatedCtx = pixelatedCanvas?.getContext('2d');
        if (pixelatedCtx && pixelatedCanvas) {
            pixelatedCtx.clearRect(0, 0, pixelatedCanvas.width, pixelatedCanvas.height);
            pixelatedCtx.fillStyle = '#6b7280';
            pixelatedCtx.font = '16px sans-serif';
            pixelatedCtx.textAlign = 'center';
            pixelatedCtx.fillText('无可用颜色，请恢复部分排除的颜色', pixelatedCanvas.width / 2, pixelatedCanvas.height / 2);
        }
        setMappedPixelData(null);
        setGridDimensions(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [originalImageSrc, granularity, gridHeight, similarityThreshold, customPaletteSelections, pixelationMode, maxColorCount, autoRemoveWhiteBg, remapTrigger]);

  // 确保文件输入框引用在组件挂载后正确设置
  useEffect(() => {
    // 延迟执行，确保DOM完全渲染
    const timer = setTimeout(() => {
      if (!fileInputRef.current) {
        console.warn("文件输入框引用在组件挂载后仍为null，这可能会导致上传功能异常");
      }
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  // 设置组件挂载状态
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // 支持 Ctrl/Cmd+V 粘贴图片
  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const items = event.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            event.preventDefault();
            setExcludedColorKeys(new Set());
            processFile(file);
          }
          break;
        }
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 空格按住时，点在图纸上也能平移（由外层画布捕获指针）
  useEffect(() => {
    const isTypingTarget = (target: EventTarget | null) => {
      const el = target as HTMLElement | null;
      const tag = el?.tagName?.toLowerCase();
      return tag === 'input' || tag === 'textarea' || tag === 'select' || !!el?.isContentEditable;
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || isTypingTarget(event.target)) return;
      spaceHeldRef.current = true;
      event.preventDefault();
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') spaceHeldRef.current = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

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

    const closeExportDialog = () => {
      setIsDownloadSettingsOpen(false);
      setExportPreviewUrl(null);
      setExportPreviewFilename('');
      setIsExportPreviewLoading(false);
    };

    /** 按弹窗里的参数生成预览，不直接下载 */
    const handlePreviewExport = async (options: GridDownloadOptions) => {
      setDownloadOptions(options);
      setIsExportPreviewLoading(true);
      setExportPreviewUrl(null);
      const result = await downloadImage({
        mappedPixelData,
        gridDimensions,
        colorCounts,
        totalBeadCount,
        options,
        activeBeadPalette,
        selectedColorSystem,
        previewOnly: true,
      });
      setIsExportPreviewLoading(false);
      if (!result) return;
      setExportPreviewUrl(result.dataUrl);
      setExportPreviewFilename(result.filename);
    };

    const handleConfirmExportDownload = (options?: GridDownloadOptions) => {
      if (!exportPreviewUrl) return;
      const link = document.createElement('a');
      link.download = exportPreviewFilename || 'bead-grid.png';
      link.href = exportPreviewUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      if (options?.exportCsv) {
        exportCsvData({
          mappedPixelData,
          gridDimensions,
          selectedColorSystem,
        });
      }
    };

    /** 应用新原图（预处理确认后）并重新生成图纸 */
    const applyPreparedImage = useCallback((dataUrl: string) => {
      setExcludedColorKeys(new Set());
      setSelectedCells(new Set());
      setShowSelectionRecolor(false);
      setCropRect(null);
      setCanvasToolMode('select');
      setIsManualColoringMode(false);
      setSelectedColor(null);
      setOriginalImageSrc(dataUrl);
      setRemapTrigger((prev) => prev + 1);
    }, []);

    const openImagePrep = useCallback((src: string) => {
      setPendingPrepImageSrc(src);
      setIsImagePrepOpen(true);
    }, []);

    const handlePrepConfirm = useCallback((preparedDataUrl: string, meta: { usedAiMatting: boolean }) => {
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
    }, [pendingPrepImageSrc, applyPreparedImage, showToast]);

    const handlePrepCancel = useCallback(() => {
      setIsImagePrepOpen(false);
      setPendingPrepImageSrc(null);
      // 若尚无正式原图，取消后回到未上传状态
    }, []);

    const handleUndoAiMatting = useCallback(() => {
      if (!preAiImageSrc) return;
      openImagePrep(preAiImageSrc);
      setPreAiImageSrc(null);
      showToast('已恢复抠图前原图，请重新确认');
    }, [preAiImageSrc, openImagePrep, showToast]);

    // --- Handler to toggle color exclusion ---
    // Kept for the color-management surface; the current list exposes highlighting only.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const handleToggleExcludeColor = (hexKey: string) => {
        const currentExcluded = excludedColorKeys;
        const isExcluding = !currentExcluded.has(hexKey);

        if (isExcluding) {
            console.log(`---------\nAttempting to EXCLUDE color: ${hexKey}`);

            // --- 确保初始颜色键已记录 ---
            if (initialGridColorKeys.size === 0) {
                console.error("Cannot exclude color: Initial grid color keys not yet calculated.");
                alert("无法排除颜色，初始颜色数据尚未准备好，请稍候。");
                return;
            }
            console.log("Initial Grid Hex Keys:", Array.from(initialGridColorKeys));
            console.log("Currently Excluded Hex Keys (before this op):", Array.from(currentExcluded));

            const nextExcludedKeys = new Set(currentExcluded);
            nextExcludedKeys.add(hexKey);

            // --- 使用初始颜色键进行重映射目标逻辑 ---
            // 1. 从初始网格颜色集合开始（hex值）
            const potentialRemapHexKeys = new Set(initialGridColorKeys);
            console.log("Step 1: Potential Hex Keys (from initial):", Array.from(potentialRemapHexKeys));

            // 2. 移除当前要排除的hex键
            potentialRemapHexKeys.delete(hexKey);
            console.log(`Step 2: Potential Hex Keys (after removing ${hexKey}):`, Array.from(potentialRemapHexKeys));

            // 3. 移除任何*其他*当前也被排除的hex键
            currentExcluded.forEach(excludedHexKey => {
                potentialRemapHexKeys.delete(excludedHexKey);
            });
            console.log("Step 3: Potential Hex Keys (after removing other current exclusions):", Array.from(potentialRemapHexKeys));

            // 4. 基于剩余的hex值创建重映射调色板
            const remapTargetPalette = fullBeadPalette.filter(color => potentialRemapHexKeys.has(color.hex.toUpperCase()));
            const remapTargetHexKeys = remapTargetPalette.map(p => p.hex.toUpperCase());
            console.log("Step 4: Remap Target Palette Hex Keys:", remapTargetHexKeys);

            // 5. *** 关键检查 ***：如果在考虑所有排除项后，没有*初始*颜色可供映射，则阻止此次排除
            if (remapTargetPalette.length === 0) {
                console.warn(`Cannot exclude color '${hexKey}'. No other valid colors from the initial grid remain after considering all current exclusions.`);
                alert(`无法排除颜色 ${hexKey}，因为图中最初存在的其他可用颜色也已被排除。请先恢复部分其他颜色。`);
                console.log("---------");
                return; // 停止排除过程
            }
            console.log(`Remapping target palette (based on initial grid colors minus all exclusions) contains ${remapTargetPalette.length} colors.`);

            // 查找被排除颜色的RGB值用于重映射
            const excludedColorData = fullBeadPalette.find(p => p.hex.toUpperCase() === hexKey);
            // 检查排除颜色的数据是否存在
             if (!excludedColorData || !mappedPixelData || !gridDimensions) {
                 console.error("Cannot exclude color: Missing data for remapping.");
                 alert("无法排除颜色，缺少必要数据。");
                console.log("---------");
                 return;
             }

            console.log(`Remapping cells currently using excluded color: ${hexKey}`);
            // 仅在需要重映射时创建深拷贝
            const newMappedData = mappedPixelData.map(row => row.map(cell => ({...cell})));
            let remappedCount = 0;
            const { N, M } = gridDimensions;
            let firstReplacementHex: string | null = null;

            for (let j = 0; j < M; j++) {
                for (let i = 0; i < N; i++) {
                const cell = newMappedData[j]?.[i];
                    // 此条件正确地仅针对具有排除hex值的单元格
                    if (cell && !cell.isExternal && cell.color.toUpperCase() === hexKey) {
                        // *** 使用派生的 remapTargetPalette 查找最接近的颜色 ***
                    const replacementColor = findClosestPaletteColor(excludedColorData.rgb, remapTargetPalette);
                        if (!firstReplacementHex) firstReplacementHex = replacementColor.hex;
                        newMappedData[j][i] = { 
                            ...cell, 
                            key: replacementColor.key, 
                            color: replacementColor.hex 
                        };
                    remappedCount++;
                }
                }
            }
            console.log(`Remapped ${remappedCount} cells. First replacement hex found was: ${firstReplacementHex || 'N/A'}`);

            // 同时更新状态
            setExcludedColorKeys(nextExcludedKeys); // 应用此颜色的排除
            setMappedPixelData(newMappedData); // 使用重映射的数据更新

            // 基于*新*映射数据重新计算计数（以hex为键）
            const newCounts: { [hexKey: string]: { count: number; color: string } } = {};
            let newTotalCount = 0;
            newMappedData.flat().forEach(cell => {
                if (cell && cell.color && !cell.isExternal) {
                    const cellHex = cell.color.toUpperCase();
                    if (!newCounts[cellHex]) {
                        newCounts[cellHex] = { count: 0, color: cellHex };
                }
                    newCounts[cellHex].count++;
                    newTotalCount++;
                }
            });
            setColorCounts(newCounts);
            setTotalBeadCount(newTotalCount);
            console.log("State updated after exclusion and local remap based on initial grid colors.");
            console.log("---------");

            // ++ 在更新状态后，重新绘制 Canvas ++
            if (pixelatedCanvasRef.current && gridDimensions) {
              setMappedPixelData(newMappedData);
              // 不要调用 setGridDimensions，因为颜色排除不需要改变网格尺寸
            } else {
               console.error("Canvas ref or grid dimensions missing, skipping draw call in handleToggleExcludeColor.");
            }

        } else {
            // --- Re-including ---
            console.log(`---------\nAttempting to RE-INCLUDE color: ${hexKey}`);
            console.log(`Re-including color: ${hexKey}. Triggering full remap.`);
            const nextExcludedKeys = new Set(currentExcluded);
            nextExcludedKeys.delete(hexKey);
            setExcludedColorKeys(nextExcludedKeys);
            // 此处无需重置 initialGridColorKeys，完全重映射会通过 pixelateImage 重新计算它
            setRemapTrigger(prev => prev + 1); // *** KEPT setRemapTrigger here for re-inclusion ***
            console.log("---------");
        }
        // ++ Exit manual mode if colors are excluded/included ++
        setIsManualColoringMode(false);
        setSelectedColor(null);
        clearEditHistory();
        setBgRemovalSnapshot(null);
    };

  // 一键去背景：识别边缘主色并洪水填充去除
  const handleAutoRemoveBackground = () => {
    if (!mappedPixelData || !gridDimensions) {
      alert('请先生成图纸后再使用一键去背景。');
      return;
    }

    // 保存快照用于单步撤回
    setBgRemovalSnapshot({
      mappedPixelData: mappedPixelData.map(row => row.map(cell => ({ ...cell }))),
      colorCounts: colorCounts ? { ...colorCounts } : {},
      totalBeadCount,
      gridDimensions: { ...gridDimensions },
      granularity,
      gridHeight,
    });
    // 去背景会大幅改变数据，清空编辑撤回历史
    setEditHistory([]);

    const { N, M } = gridDimensions;
    const borderCounts = new Map<string, number>();

    const countBorderCell = (row: number, col: number) => {
      const cell = mappedPixelData[row]?.[col];
      if (!cell || cell.isExternal || cell.key === TRANSPARENT_KEY) return;
      borderCounts.set(cell.key, (borderCounts.get(cell.key) || 0) + 1);
    };

    for (let col = 0; col < N; col++) {
      countBorderCell(0, col);
      if (M > 1) countBorderCell(M - 1, col);
    }
    for (let row = 1; row < M - 1; row++) {
      countBorderCell(row, 0);
      if (N > 1) countBorderCell(row, N - 1);
    }

    if (borderCounts.size === 0) {
      alert('边缘没有可识别的背景颜色。');
      return;
    }

    let targetKey = '';
    let maxCount = -1;
    borderCounts.forEach((count, key) => {
      if (count > maxCount) {
        maxCount = count;
        targetKey = key;
      }
    });

    const newPixelData = mappedPixelData.map(row => row.map(cell => ({ ...cell })));
    const visited = Array(M).fill(null).map(() => Array(N).fill(false));
    const stack: { row: number; col: number }[] = [];

    const pushIfTarget = (row: number, col: number) => {
      if (row < 0 || row >= M || col < 0 || col >= N || visited[row][col]) {
        return;
      }
      const cell = newPixelData[row][col];
      if (!cell || cell.isExternal || cell.key !== targetKey) return;
      visited[row][col] = true;
      stack.push({ row, col });
    };

    for (let col = 0; col < N; col++) {
      pushIfTarget(0, col);
      if (M > 1) pushIfTarget(M - 1, col);
    }
    for (let row = 1; row < M - 1; row++) {
      pushIfTarget(row, 0);
      if (N > 1) pushIfTarget(row, N - 1);
    }

    if (stack.length === 0) {
      alert('未找到可去除的背景区域。');
      return;
    }

    while (stack.length > 0) {
      const { row, col } = stack.pop()!;
      newPixelData[row][col] = { ...transparentColorData };
      pushIfTarget(row - 1, col);
      pushIfTarget(row + 1, col);
      pushIfTarget(row, col - 1);
      pushIfTarget(row, col + 1);
    }

    setMappedPixelData(newPixelData);

    const newColorCounts: { [hexKey: string]: { count: number; color: string } } = {};
    let newTotalCount = 0;
    newPixelData.flat().forEach(cell => {
      if (cell && !cell.isExternal && cell.key !== TRANSPARENT_KEY) {
        const cellHex = cell.color.toUpperCase();
        if (!newColorCounts[cellHex]) {
          newColorCounts[cellHex] = {
            count: 0,
            color: cellHex
          };
        }
        newColorCounts[cellHex].count++;
        newTotalCount++;
      }
    });

    setColorCounts(newColorCounts);
    setTotalBeadCount(newTotalCount);
    setInitialGridColorKeys(new Set(Object.keys(newColorCounts)));
  };

  // --- Tooltip Logic ---

  // --- Canvas Interaction ---

  // 洪水填充擦除函数
  const floodFillErase = (startRow: number, startCol: number, targetKey: string) => {
    if (!mappedPixelData || !gridDimensions) return;

    const { N, M } = gridDimensions;
    const newPixelData = mappedPixelData.map(row => row.map(cell => ({ ...cell })));
    const visited = Array(M).fill(null).map(() => Array(N).fill(false));
    
    // 使用栈实现非递归洪水填充
    const stack = [{ row: startRow, col: startCol }];
    
    while (stack.length > 0) {
      const { row, col } = stack.pop()!;
      
      // 检查边界
      if (row < 0 || row >= M || col < 0 || col >= N || visited[row][col]) {
        continue;
      }
      
      const currentCell = newPixelData[row][col];
      
      // 检查是否是目标颜色且不是外部区域
      if (!currentCell || currentCell.isExternal || currentCell.key !== targetKey) {
        continue;
      }
      
      // 标记为已访问
      visited[row][col] = true;
      
      // 擦除当前像素（设为透明）
      newPixelData[row][col] = { ...transparentColorData };
      
      // 添加相邻像素到栈中
      stack.push(
        { row: row - 1, col }, // 上
        { row: row + 1, col }, // 下
        { row, col: col - 1 }, // 左
        { row, col: col + 1 }  // 右
      );
    }
    
    // 更新状态
    saveEditSnapshot();
    setMappedPixelData(newPixelData);

    // 重新计算颜色统计
    if (colorCounts) {
      const newColorCounts: { [hexKey: string]: { count: number; color: string } } = {};
      let newTotalCount = 0;
      
      newPixelData.flat().forEach(cell => {
        if (cell && !cell.isExternal && cell.key !== TRANSPARENT_KEY) {
          const cellHex = cell.color.toUpperCase();
          if (!newColorCounts[cellHex]) {
            newColorCounts[cellHex] = {
              count: 0,
              color: cellHex
            };
          }
          newColorCounts[cellHex].count++;
          newTotalCount++;
        }
      });
      
      setColorCounts(newColorCounts);
      setTotalBeadCount(newTotalCount);
    }
  };

  // ++ Re-introduce the combined interaction handler ++
  const handleCanvasInteraction = (
    clientX: number, 
    clientY: number, 
    pageX: number, 
    pageY: number, 
    isClick: boolean = false,
    isTouchEnd: boolean = false
  ) => {
    // 如果是触摸结束或鼠标离开事件，隐藏提示
    if (isTouchEnd) {
      setTooltipData(null);
      return;
    }

    const canvas = pixelatedCanvasRef.current;
    if (!canvas || !mappedPixelData || !gridDimensions) {
      setTooltipData(null);
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const canvasX = (clientX - rect.left) * scaleX;
    const canvasY = (clientY - rect.top) * scaleY;

    const { N, M } = gridDimensions;
    // 与 PixelatedPreviewCanvas 布局保持一致（含坐标轴边距）
    const cellSize = Math.max(8, Math.round(16 * previewZoom));
    const axisSize = Math.max(22, Math.min(36, Math.round(cellSize * 1.4)));
    const i = Math.floor((canvasX - axisSize) / cellSize);
    const j = Math.floor((canvasY - axisSize) / cellSize);

    if (i >= 0 && i < N && j >= 0 && j < M) {
      const cellData = mappedPixelData[j][i];

      // 颜色替换模式逻辑 - 选择源颜色
      if (isClick && colorReplaceState.isActive && colorReplaceState.step === 'select-source') {
        if (cellData && !cellData.isExternal && cellData.key && cellData.key !== TRANSPARENT_KEY) {
          // 执行选择源颜色
          handleCanvasColorSelect({
            key: cellData.key,
            color: cellData.color
          });
          setTooltipData(null);
        }
        return;
      }

      // 一键擦除模式逻辑
      if (isClick && isEraseMode) {
        if (cellData && !cellData.isExternal && cellData.key && cellData.key !== TRANSPARENT_KEY) {
          // 执行洪水填充擦除
          floodFillErase(j, i, cellData.key);
          setIsEraseMode(false); // 擦除完成后退出擦除模式
          setTooltipData(null);
        }
        return;
      }

      if (isClick && isManualColoringMode && selectedColor) {
        handlePaintCell(j, i);
        return;
      }

      // 预览模式：点击仅显示色号，不吸色、不直接改色（改色走多选）
      // Tooltip Logic (非手动上色模式点击或悬停)
      if (!isManualColoringMode || !selectedColor) {
        // 只有单元格实际有内容（非背景/外部区域）才会显示提示
        if (cellData && !cellData.isExternal && cellData.key) {
          // 检查是否已经显示了提示框，并且是否点击的是同一个位置
          if (isClick && tooltipData) {
            const tooltipRect = canvas.getBoundingClientRect();
            const prevX = tooltipData.x;
            const prevY = tooltipData.y;
            const prevCanvasX = (prevX - tooltipRect.left) * scaleX;
            const prevCanvasY = (prevY - tooltipRect.top) * scaleY;
            const prevCellI = Math.floor((prevCanvasX - axisSize) / cellSize);
            const prevCellJ = Math.floor((prevCanvasY - axisSize) / cellSize);

            if (i === prevCellI && j === prevCellJ) {
              setTooltipData(null);
              return;
            }
          }

          const mainElement = mainRef.current;
          if (mainElement) {
            const mainRect = mainElement.getBoundingClientRect();
            setTooltipData({
              x: clientX - mainRect.left,
              y: clientY - mainRect.top,
              key: cellData.key,
              color: cellData.color,
            });
          } else {
            setTooltipData({
              x: clientX,
              y: clientY,
              key: cellData.key,
              color: cellData.color,
            });
          }
        } else {
          setTooltipData(null);
        }
      } else {
        setTooltipData(null);
      }
    } else {
      setTooltipData(null);
    }
  };

  // 处理自定义色板中单个颜色的选择变化
  const handleSelectionChange = (hexValue: string, isSelected: boolean) => {
    const normalizedHex = hexValue.toUpperCase();
    setCustomPaletteSelections(prev => ({
      ...prev,
      [normalizedHex]: isSelected
    }));
  };

  // 保存自定义色板并应用
  const handleSaveCustomPalette = () => {
    savePaletteSelections(customPaletteSelections);
    setIsCustomPaletteEditorOpen(false);
    // 触发图像重新处理
    setRemapTrigger(prev => prev + 1);
    // 退出手动上色模式
    setIsManualColoringMode(false);
    setSelectedColor(null);
    setIsEraseMode(false);
  };

  // ++ 新增：导出自定义色板配置 ++
  const handleExportCustomPalette = () => {
    const selectedHexValues = Object.entries(customPaletteSelections)
      .filter(([, isSelected]) => isSelected)
      .map(([hexValue]) => hexValue);

    if (selectedHexValues.length === 0) {
      alert("当前没有选中的颜色，无法导出。");
      return;
    }

    // 导出格式：仅基于hex值
    const exportData = {
      version: "3.0", // 新版本号
      selectedHexValues: selectedHexValues,
      exportDate: new Date().toISOString(),
      totalColors: selectedHexValues.length
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'custom-perler-palette.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // ++ 新增：处理导入的色板文件 ++
  const handleImportPaletteFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const data = JSON.parse(content);

        // 检查文件格式
        if (!Array.isArray(data.selectedHexValues)) {
          throw new Error("无效的文件格式：文件必须包含 'selectedHexValues' 数组。");
        }

        console.log("检测到基于hex值的色板文件");

        const importedHexValues = data.selectedHexValues as string[];
        const validHexValues: string[] = [];
        const invalidHexValues: string[] = [];

        // 验证hex值
        importedHexValues.forEach(hex => {
          const normalizedHex = hex.toUpperCase();
          const colorData = fullBeadPalette.find(color => color.hex.toUpperCase() === normalizedHex);
          if (colorData) {
            validHexValues.push(normalizedHex);
          } else {
            invalidHexValues.push(hex);
          }
        });

        if (invalidHexValues.length > 0) {
          console.warn("导入时发现无效的hex值:", invalidHexValues);
          alert(`导入完成，但以下颜色无效已被忽略：\n${invalidHexValues.join(', ')}`);
        }

        if (validHexValues.length === 0) {
          alert("导入的文件中不包含任何有效的颜色。");
          return;
        }

        console.log(`成功验证 ${validHexValues.length} 个有效的hex值`);

        // 基于有效的hex值创建新的selections对象
        const allHexValues = fullBeadPalette.map(color => color.hex.toUpperCase());
        const newSelections = presetToSelections(allHexValues, validHexValues);
        setCustomPaletteSelections(newSelections);
        alert(`成功导入 ${validHexValues.length} 个颜色！`);

      } catch (error) {
        console.error("导入色板配置失败:", error);
        alert(`导入失败: ${error instanceof Error ? error.message : '未知错误'}`);
      } finally {
        // 重置文件输入，以便可以再次导入相同的文件
        if (event.target) {
          event.target.value = '';
        }
      }
    };
    reader.onerror = () => {
      alert("读取文件失败。");
       // 重置文件输入
      if (event.target) {
        event.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  // ++ 新增：触发导入文件选择 ++
  const triggerImportPalette = () => {
    importPaletteInputRef.current?.click();
  };

  // 新增：高亮完成回调
  const handleHighlightComplete = () => {
    setHighlightColorKey(null);
  };

  // 新增：处理从画布选择源颜色
  const handleCanvasColorSelect = (colorData: { key: string; color: string }) => {
    if (colorReplaceState.isActive && colorReplaceState.step === 'select-source') {
      // 高亮显示选中的颜色
      setHighlightColorKey(colorData.color);
      // 进入第二步：选择目标颜色
      setColorReplaceState({
        isActive: true,
        step: 'select-target',
        sourceColor: colorData
      });
    }
  };

  const ingredientBill = useMemo<IngredientBill | null>(() => {
    if (!mappedPixelData || !gridDimensions) return null;
    return generateIngredientBill(mappedPixelData, selectedColorSystem, {
      cols: gridDimensions.N,
      rows: gridDimensions.M,
    });
  }, [mappedPixelData, gridDimensions, selectedColorSystem]);

  return (
    <>
    {/* 添加自定义动画样式 */}
    <style dangerouslySetInnerHTML={{ __html: floatAnimation }} />
    <style dangerouslySetInnerHTML={{ __html: '@keyframes toastFadeInOut{0%{opacity:0;transform:translate(-50%,10px)}15%{opacity:1;transform:translate(-50%,0)}85%{opacity:1;transform:translate(-50%,0)}100%{opacity:0;transform:translate(-50%,-10px)}}' }} />
    
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

    {/* 工作台布局：左参数 / 右预览 */}
    <div className="min-h-screen flex flex-col bg-[#f6f7f9] dark:bg-gray-950 font-[family-name:var(--font-geist-sans)]">
      <main ref={mainRef} className="relative flex-1 w-full max-w-[1920px] mx-auto px-3 sm:px-4 lg:px-5 py-3 sm:py-4">
        <div className="grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)] gap-3 lg:gap-4 items-start">
          {/* 左侧：上传与参数 */}
          <aside className="w-full space-y-3 lg:sticky lg:top-3 lg:max-h-[calc(100vh-1.5rem)] lg:overflow-y-auto pb-2">
            <h1 className="px-1 text-base font-semibold tracking-tight text-gray-900 dark:text-gray-100">喵喵的拼豆小屋</h1>
            <section className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4">
              <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-3">原图与上传</h2>
              {originalImageSrc ? (
                <div className="space-y-3">
                  <div className="relative rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={originalImageSrc} alt="原图预览" className="w-full max-h-44 object-contain" />
                  </div>
                  <button
                    type="button"
                    onClick={() => openImagePrep(preAiImageSrc || originalImageSrc)}
                    className="w-full h-9 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 text-sm font-medium hover:bg-amber-100"
                  >
                    重新裁剪 / 抠图
                  </button>
                  {preAiImageSrc && (
                    <button
                      type="button"
                      onClick={handleUndoAiMatting}
                      className="w-full h-8 rounded-lg border border-violet-200 text-violet-600 text-xs hover:bg-violet-50"
                    >
                      用抠图前原图重新处理
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={isMounted ? triggerFileInput : undefined}
                    className="w-full h-9 rounded-lg border border-gray-300 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    更换图片
                  </button>
                </div>
              ) : pendingPrepImageSrc && isImagePrepOpen ? (
                <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50/50 p-4 text-center text-sm text-amber-800">
                  请在弹窗中完成裁剪 / 抠图后确认
                </div>
              ) : (
                <div
                  onDrop={handleDrop} onDragOver={handleDragOver} onDragEnter={handleDragOver}
                  onClick={isMounted ? triggerFileInput : undefined}
                  className={`border-2 border-dashed border-amber-300 dark:border-amber-700/60 rounded-xl p-6 text-center ${isMounted ? 'cursor-pointer hover:border-amber-400 hover:bg-amber-50/60 dark:hover:bg-amber-900/10' : 'cursor-wait'} transition-all duration-300 w-full flex flex-col justify-center items-center bg-amber-50/30 dark:bg-gray-900/20`}
                  style={{ minHeight: '140px' }}
                >
                  <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-amber-400 text-white shadow-sm">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-200 font-medium">点击、拖拽或粘贴图片到这里</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">支持 JPG, PNG, GIF（或 CSV）</p>
                </div>
              )}
              <input type="file" accept="image/jpeg, image/png, image/gif, .csv, text/csv, application/csv, text/plain" onChange={handleFileChange} ref={fileInputRef} className="hidden" />
            </section>

            {!isManualColoringMode && (
              <section className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">生成设置</h2>
                  {mappedPixelData && <span className="text-[11px] text-emerald-600">已生成</span>}
                </div>

                {/* 色板品牌 */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1.5">色板品牌</label>
                  <select
                    value={selectedColorSystem}
                    onChange={(e) => setSelectedColorSystem(e.target.value as ColorSystem)}
                    className="w-full h-10 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 text-sm text-gray-900 dark:text-gray-100"
                  >
                    {colorSystemOptions.map(option => (
                      <option key={option.key} value={option.key}>{option.name}</option>
                    ))}
                  </select>
                </div>

                {/* 图纸尺寸 宽 x 高 */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-300">图纸尺寸 (宽 × 高)</label>
                    <button
                      type="button"
                      onClick={() => setKeepAspectRatio(v => !v)}
                      className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md border ${
                        keepAspectRatio
                          ? 'border-amber-400 bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-600'
                          : 'border-gray-300 text-gray-500 dark:border-gray-600 dark:text-gray-400'
                      }`}
                      title="保持比例"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                      </svg>
                      保持比例
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={10}
                      max={300}
                      value={granularityInput}
                      onChange={handleGranularityInputChange}
                      onBlur={() => applyGridWidth(parseInt(granularityInput, 10) || 10)}
                      onKeyDown={(e) => { if (e.key === 'Enter') applyGridWidth(parseInt(granularityInput, 10) || 10); }}
                      className="w-full h-10 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 text-sm text-center"
                    />
                    <span className="text-gray-400">×</span>
                    <input
                      type="number"
                      min={10}
                      max={300}
                      value={gridHeightInput}
                      onChange={handleGridHeightInputChange}
                      onBlur={() => {
                        if (!keepAspectRatio) applyGridHeight(parseInt(gridHeightInput, 10) || 10);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !keepAspectRatio) applyGridHeight(parseInt(gridHeightInput, 10) || 10);
                      }}
                      readOnly={keepAspectRatio}
                      aria-label={keepAspectRatio ? '图纸高度（按比例自动计算）' : '图纸高度'}
                      className={`w-full h-10 rounded-lg border border-gray-300 dark:border-gray-600 px-3 text-sm text-center ${keepAspectRatio ? 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 cursor-not-allowed' : 'bg-white dark:bg-gray-700'}`}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleConfirmParameters}
                    className="mt-2 w-full h-9 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium"
                  >
                    应用尺寸
                    {gridDimensions ? ` · 当前 ${gridDimensions.N}×${gridDimensions.M}` : ''}
                  </button>
                </div>

                {/* 精简拼豆种类 */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-300">🎨 精简拼豆种类 (限制用色)</label>
                    <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                      {maxColorCount === 0 ? '无限制 (原图直转)' : `限制 ${maxColorCount} 色`}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={30}
                    step={1}
                    value={maxColorCount}
                    onChange={(e) => {
                      setMaxColorCount(Number(e.target.value));
                    }}
                    className="w-full accent-amber-500"
                  />
                  <p className="mt-1.5 text-[11px] leading-relaxed text-gray-400 dark:text-gray-500">
                    如果不限制，生成的图纸可能会用到几十种颜色，导致买豆成本极高。建议限制在 15-20 种以内。
                  </p>
                </div>

                {/* 自动去除白底 */}
                <label className="flex items-start gap-2.5 cursor-pointer select-none rounded-lg border border-gray-200 dark:border-gray-700 p-3 hover:bg-gray-50 dark:hover:bg-gray-900/30">
                  <input
                    type="checkbox"
                    checked={autoRemoveWhiteBg}
                    onChange={(e) => setAutoRemoveWhiteBg(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-gray-300 text-amber-500 focus:ring-amber-400"
                  />
                  <span>
                    <span className="block text-sm text-gray-800 dark:text-gray-100">✨ 自动去除白底 &amp; 紧凑排版</span>
                    <span className="block mt-1 text-[11px] leading-relaxed text-gray-400 dark:text-gray-500">
                      如果原图带有纯白背景，强烈建议勾选！会自动扣掉白底并减少废豆。
                    </span>
                  </span>
                </label>

                {/* 进阶选项 */}
                <details className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                  <summary className="cursor-pointer text-xs font-medium text-gray-600 dark:text-gray-300">进阶选项</summary>
                  <div className="mt-3 space-y-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">颜色合并阈值 (0-100)</label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={similarityThresholdInput}
                          onChange={handleSimilarityThresholdInputChange}
                          className="w-full h-9 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 text-sm"
                        />
                        <button type="button" onClick={handleConfirmParameters} className="h-9 px-3 rounded-md bg-gray-800 text-white text-xs whitespace-nowrap dark:bg-gray-600">应用</button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">处理模式</label>
                      <select
                        value={pixelationMode}
                        onChange={handlePixelationModeChange}
                        className="w-full h-9 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 text-sm"
                      >
                        <option value={PixelationMode.Dominant}>卡通 (主色)</option>
                        <option value={PixelationMode.Average}>真实 (平均)</option>
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsCustomPaletteEditorOpen(true)}
                      className="w-full h-9 rounded-md border border-gray-300 dark:border-gray-600 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      管理色板 ({Object.values(customPaletteSelections).filter(Boolean).length} 色)
                    </button>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleAutoRemoveBackground}
                        disabled={!mappedPixelData || !gridDimensions}
                        className="flex-1 h-9 rounded-md border border-gray-300 dark:border-gray-600 text-xs disabled:opacity-50"
                      >
                        手动去背景
                      </button>
                      <button
                        type="button"
                        onClick={handleUndoBgRemoval}
                        disabled={!bgRemovalSnapshot}
                        className="flex-1 h-9 rounded-md border border-gray-300 dark:border-gray-600 text-xs disabled:opacity-50"
                      >
                        回撤去背景
                      </button>
                    </div>
                  </div>
                </details>
              </section>
            )}

        {/* Message if palette becomes empty (Also hide in manual mode) */}
         {!isManualColoringMode && originalImageSrc && activeBeadPalette.length === 0 && excludedColorKeys.size > 0 && (
             // Apply dark mode styles to the warning box
             <div className="w-full bg-yellow-100 dark:bg-yellow-900/50 p-4 rounded-lg shadow border border-yellow-200 dark:border-yellow-800/60 text-center text-sm text-yellow-800 dark:text-yellow-300">
                 当前可用颜色过少或为空。请在色板管理中恢复颜色，或更换色板。
                 {excludedColorKeys.size > 0 && (
                      // Apply dark mode styles to the inline "restore all" button
                      <button
                          onClick={() => {
                            // 滚动到颜色列表处
                            setTimeout(() => {
                              const listElement = document.querySelector('.color-stats-panel');
                              if (listElement) {
                                listElement.scrollIntoView({ behavior: 'smooth' });
                              }
                            }, 100);
                          }}
                          className="mt-2 ml-2 text-xs py-1 px-2 bg-yellow-200 dark:bg-yellow-700/60 text-yellow-900 dark:text-yellow-200 rounded hover:bg-yellow-300 dark:hover:bg-yellow-600/70 transition-colors"
                      >
                          查看已排除颜色 ({excludedColorKeys.size})
                      </button>
                  )}
             </div>
         )}

        {/* ++ HIDE Download Buttons in manual mode ++ */}
        {!isManualColoringMode && originalImageSrc && mappedPixelData && (
            <div className="w-full mt-4">
              {/* 使用一个大按钮，现在所有的下载设置都通过弹窗控制 */}
              <button
                type="button"
                onClick={() => setIsDownloadSettingsOpen(true)}
                disabled={!mappedPixelData || !gridDimensions || gridDimensions.N === 0 || gridDimensions.M === 0 || activeBeadPalette.length === 0}
                className="w-full h-10 px-4 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
               >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                导出图纸
              </button>
              <button
                type="button"
                onClick={() => setIsIngredientBillOpen(true)}
                disabled={!ingredientBill}
                className="mt-2 flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                采购清单
                {ingredientBill ? ` · ${ingredientBill.colorCount} 色` : ''}
              </button>
            </div>
        )} {/* ++ End of HIDE Download Buttons ++ */}

          </aside>

          {/* 右侧：图纸预览 */}
          <section className="w-full flex-1 min-w-0">
            <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-3 sm:p-4 min-h-[420px] lg:min-h-[calc(100vh-8rem)] flex flex-col">
              <div className="flex flex-col gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">图纸预览</h2>
                  {gridDimensions && <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] text-gray-500 dark:bg-gray-800 dark:text-gray-400">{gridDimensions.N} × {gridDimensions.M}</span>}
                </div>
                <p className="text-[11px] text-gray-400">拖拽框选改色，点已选格子可取消；空白处或空格拖动可移动画布</p>
              </div>

              <canvas ref={originalCanvasRef} className="hidden"></canvas>

              {/* 画布 + 右侧色块统计 */}
              <div className="flex flex-col lg:flex-row gap-3 flex-1 min-h-0">
                {/* 工作区画布 */}
                <div className="relative flex-1 min-w-0 min-h-[420px] lg:min-h-[calc(100vh-12rem)] rounded-lg bg-[#eef0f3] dark:bg-gray-950 border border-gray-200 dark:border-gray-800 overflow-hidden">
                  {!originalImageSrc ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 dark:text-gray-500">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-14 w-14 mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.25}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      <p className="text-sm">请先在左侧上传图片</p>
                    </div>
                  ) : (
                    <div
                      className="absolute inset-0 overflow-hidden cursor-grab active:cursor-grabbing"
                      onWheel={(event) => {
                        event.preventDefault();
                        setCanvasOffset((prev) => ({
                          x: prev.x - event.deltaX,
                          y: prev.y - event.deltaY,
                        }));
                      }}
                      onPointerDown={(event) => {
                        if (event.button !== 0) return;
                        const onDrawing = !!(event.target as HTMLElement).closest('canvas');
                        // 图纸上默认框选；按住空格时改为拖动画布
                        if (onDrawing && !spaceHeldRef.current) return;
                        event.preventDefault();
                        canvasPanRef.current = {
                          x: event.clientX,
                          y: event.clientY,
                          pointerId: event.pointerId,
                        };
                        event.currentTarget.setPointerCapture(event.pointerId);
                      }}
                      onPointerMove={(event) => {
                        const pan = canvasPanRef.current;
                        if (!pan || pan.pointerId !== event.pointerId) return;
                        const dx = event.clientX - pan.x;
                        const dy = event.clientY - pan.y;
                        canvasPanRef.current = { ...pan, x: event.clientX, y: event.clientY };
                        setCanvasOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
                      }}
                      onPointerUp={(event) => {
                        if (canvasPanRef.current?.pointerId === event.pointerId) {
                          canvasPanRef.current = null;
                        }
                      }}
                      onPointerCancel={() => {
                        canvasPanRef.current = null;
                      }}
                    >
                      <div
                        className="absolute left-0 top-0"
                        style={{ transform: `translate(${canvasOffset.x}px, ${canvasOffset.y}px)` }}
                      >
                        <div className="shadow-sm rounded-md overflow-hidden bg-white dark:bg-gray-800 ring-1 ring-black/5 dark:ring-white/10">
                          <PixelatedPreviewCanvas
                            canvasRef={pixelatedCanvasRef}
                            mappedPixelData={mappedPixelData}
                            gridDimensions={gridDimensions}
                            isManualColoringMode={false}
                            onInteraction={handleCanvasInteraction}
                            highlightColorKey={highlightColorKey}
                            onHighlightComplete={handleHighlightComplete}
                            selectedColorSystem={selectedColorSystem}
                            previewZoom={previewZoom}
                            toolMode={canvasToolMode}
                            selectedCells={selectedCells}
                            onSelectCells={handleSelectCells}
                            onSelectionDoubleClick={handleOpenSelectionRecolor}
                            cropRect={cropRect}
                            onCropRectChange={setCropRect}
                            onPanBy={(dx, dy) => setCanvasOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }))}
                          />
                        </div>
                      </div>
                    </div>
                  )}
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
                        <span className="mx-1 h-5 w-px shrink-0 bg-gray-200 dark:bg-gray-700" />
                        <IconButton
                          aria-label="缩小"
                          title="缩小"
                          onClick={() => setPreviewZoom(z => Math.max(0.5, Math.round((z - 0.25) * 100) / 100))}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
                          </svg>
                        </IconButton>
                        <button
                          type="button"
                          title="重置为 100%"
                          onClick={() => setPreviewZoom(1)}
                          className="h-9 min-w-[3rem] shrink-0 rounded-lg px-1.5 text-[11px] font-medium text-gray-600 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-gray-300 dark:hover:bg-gray-800"
                        >
                          {Math.round(previewZoom * 100)}%
                        </button>
                        <IconButton
                          aria-label="放大"
                          title="放大"
                          onClick={() => setPreviewZoom(z => Math.min(3, Math.round((z + 0.25) * 100) / 100))}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
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
                </div>

                {/* 颜色统计：点击选中该色号全部格子 */}
                {originalImageSrc && colorCounts && Object.keys(colorCounts).length > 0 && (
                    <aside className="color-stats-panel w-full lg:w-[220px] xl:w-[250px] shrink-0 flex flex-col rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950/60 p-3 lg:max-h-[calc(100vh-12rem)]">
                    <div className="mb-2 shrink-0">
                      <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">颜色统计</h3>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                        共 {Object.keys(colorCounts).length} 色 · {totalBeadCount.toLocaleString()} 颗 · 点击全选该色
                      </p>
                    </div>
                    <div className="flex-1 min-h-0 overflow-y-auto space-y-1 pr-0.5">
                      {Object.keys(colorCounts)
                        .sort(sortColorKeys)
                        .map((hexKey) => {
                          const displayColorKey = getColorKeyByHex(hexKey, selectedColorSystem);
                          const count = colorCounts[hexKey].count;
                          const colorHex = colorCounts[hexKey].color;
                          const isActiveHighlight = highlightColorKey?.toUpperCase() === hexKey.toUpperCase();
                          return (
                            <button
                              key={hexKey}
                              type="button"
                              onClick={() => handleSelectAllByColor(hexKey)}
                              title={`选中全部 ${displayColorKey}（${count} 格）`}
                              className={`flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-left transition-colors ${
                                isActiveHighlight
                                  ? 'border-blue-400 bg-blue-50 dark:border-blue-500 dark:bg-blue-900/40 ring-1 ring-blue-300'
                                  : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 bg-white dark:bg-gray-900/30'
                              }`}
                            >
                              <ColorSwatch hex={colorHex} size="sm" />
                              <span className="min-w-0 flex-1 truncate font-mono text-xs text-gray-800 dark:text-gray-200">
                                {displayColorKey}
                              </span>
                              <span className="text-[11px] shrink-0 text-gray-500 dark:text-gray-400">{count}</span>
                            </button>
                          );
                        })}
                    </div>
                  </aside>
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

      {/* 专心拼豆模式进入前下载提醒弹窗 */}
      <FocusModePreDownloadModal
        isOpen={isFocusModePreDownloadModalOpen}
        onClose={() => setIsFocusModePreDownloadModalOpen(false)}
        onProceedWithoutDownload={handleProceedToFocusMode}
        mappedPixelData={mappedPixelData}
        gridDimensions={gridDimensions}
        selectedColorSystem={selectedColorSystem}
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
