'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from 'react';
import { importCsvData } from '../../utils/imageDownloader';
import { generateSyntheticImageFromPixelData } from '../../domain/pixelation/syntheticImage';
import type { MappedPixel } from '../../domain/pixelation';
import {
  recognizePatternFromSrc,
  type PatternGridSource,
} from '../../domain/pixelation/patternRecognition';
import { useEditorStore } from './editorStore';
import { useEditorUiStore } from './editorUiStore';

export type UseImageUploadOptions = {
  openImagePrep: (imageSrc: string) => void;
  /** 预留：上传路径当前多用 alert；与其它 editor hooks 对齐 */
  showToast?: (msg: string) => void;
};

function gridSourceLabel(source: PatternGridSource): string {
  switch (source) {
    case 'auto':
      return '自动检出网格';
    case 'auto-cropped':
      return '裁剪后自动检出网格';
    case 'manual-cropped':
      return '未检出网格，已裁剪并按设定尺寸均分';
    case 'manual':
    default:
      return '未检出网格，已按设定尺寸均分';
  }
}

function fileToDataUrl(file: File): Promise<string> {
  const isGif = file.type === 'image/gif' || file.name.toLowerCase().endsWith('.gif');
  if (isGif) {
    return createImageBitmap(file).then((bitmap) => {
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('无法创建 Canvas 上下文');
      ctx.drawImage(bitmap, 0, 0);
      bitmap.close();
      return canvas.toDataURL('image/png');
    });
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = () => reject(new Error('无法读取文件。'));
    reader.readAsDataURL(file);
  });
}

/** 图片 / CSV 上传、拖放、粘贴与文件选择触发 */
export function useImageUpload({ openImagePrep, showToast }: UseImageUploadOptions) {
  const setMappedPixelData = useEditorStore((s) => s.setMappedPixelData);
  const setGridDimensions = useEditorStore((s) => s.setGridDimensions);
  const setColorCounts = useEditorStore((s) => s.setColorCounts);
  const setTotalBeadCount = useEditorStore((s) => s.setTotalBeadCount);
  const setOriginalImageSrc = useEditorStore((s) => s.setOriginalImageSrc);
  const setPreAiImageSrc = useEditorStore((s) => s.setPreAiImageSrc);
  const setGranularity = useEditorStore((s) => s.setGranularity);
  const setGranularityInput = useEditorStore((s) => s.setGranularityInput);
  const setGridHeight = useEditorStore((s) => s.setGridHeight);
  const setGridHeightInput = useEditorStore((s) => s.setGridHeightInput);
  const setSelectedColor = useEditorStore((s) => s.setSelectedColor);
  const markGridManuallyEdited = useEditorStore((s) => s.markGridManuallyEdited);

  const setPreviewZoom = useEditorUiStore((s) => s.setPreviewZoom);
  const setRecognizingPattern = useEditorUiStore((s) => s.setRecognizingPattern);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isMounted, setIsMounted] = useState(false);
  /** 刚上传、尚未选择「转像素 / 图纸识别」的暂存图 */
  const [stagedUploadSrc, setStagedUploadSrc] = useState<string | null>(null);
  const showToastRef = useRef(showToast);
  showToastRef.current = showToast;
  const notify = useCallback((msg: string) => {
    const fn = showToastRef.current;
    if (fn) fn(msg);
    else alert(msg);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!fileInputRef.current) {
        console.warn('文件输入框引用在组件挂载后仍为null，这可能会导致上传功能异常');
      }
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const applyRecognizedPattern = useCallback(
    (
      imageSrc: string,
      mappedPixelData: MappedPixel[][],
      gridDimensions: { N: number; M: number },
      gridSource: PatternGridSource,
    ) => {
      const colorCountsMap: { [key: string]: { count: number; color: string } } = {};
      let totalCount = 0;

      mappedPixelData.forEach((row) => {
        row.forEach((cell) => {
          if (cell && !cell.isExternal) {
            const colorKey = cell.color.toUpperCase();
            if (colorCountsMap[colorKey]) {
              colorCountsMap[colorKey].count++;
            } else {
              colorCountsMap[colorKey] = {
                count: 1,
                color: cell.color,
              };
            }
            totalCount++;
          }
        });
      });

      setMappedPixelData(mappedPixelData);
      setGridDimensions(gridDimensions);
      setColorCounts(colorCountsMap);
      setTotalBeadCount(totalCount);
      setSelectedColor(null);
      setPreAiImageSrc(null);
      setPreviewZoom(1);
      setGranularity(gridDimensions.N);
      setGranularityInput(String(gridDimensions.N));
      setGridHeight(gridDimensions.M);
      setGridHeightInput(String(gridDimensions.M));
      setOriginalImageSrc(imageSrc);
      markGridManuallyEdited();
      useEditorStore.getState().setRecognizedBaseline(mappedPixelData);

      notify(
        `图纸识别完成：${gridDimensions.N}×${gridDimensions.M}，${Object.keys(colorCountsMap).length} 种颜色。${gridSourceLabel(gridSource)}。`,
      );
    },
    [
      markGridManuallyEdited,
      notify,
      setColorCounts,
      setGranularity,
      setGranularityInput,
      setGridDimensions,
      setGridHeight,
      setGridHeightInput,
      setMappedPixelData,
      setOriginalImageSrc,
      setPreAiImageSrc,
      setPreviewZoom,
      setSelectedColor,
      setTotalBeadCount,
    ],
  );

  /** 对已裁剪区域执行图纸识别（由上传处理弹窗确认后调用） */
  const handleRecognizeRegionConfirm = useCallback(
    async (
      croppedDataUrl: string,
      options?: {
        cols?: number;
        rows?: number;
        maxColors?: number;
        preferAutoGrid?: boolean;
      },
    ) => {
      if (useEditorUiStore.getState().isRecognizingPattern) return;

      const { activeBeadPalette, granularity, gridHeight, maxColorCount } =
        useEditorStore.getState();
      if (!activeBeadPalette.length) {
        notify('当前色板为空，请先在色板管理中勾选颜色。');
        return;
      }

      const cols = Math.max(2, Math.round(options?.cols ?? granularity));
      const rows = Math.max(2, Math.round(options?.rows ?? gridHeight));
      const colors =
        typeof options?.maxColors === 'number' ? options.maxColors : maxColorCount;
      // 默认按弹窗设定尺寸，避免自动检出覆盖用户输入
      const preferAutoGrid = options?.preferAutoGrid === true;

      setRecognizingPattern(true);
      try {
        // 让「识别中…」先完成一帧绘制，再跑同步重计算
        await new Promise<void>((resolve) => {
          setTimeout(resolve, 0);
        });
        const result = await recognizePatternFromSrc(croppedDataUrl, {
          palette: activeBeadPalette,
          fallbackCols: cols,
          fallbackRows: rows,
          preferAutoGrid,
          // 设置里限色>0 时尊重；否则识别端按频率自动压杂色
          maxColors: colors > 0 ? colors : 0,
        });
        applyRecognizedPattern(
          croppedDataUrl,
          result.mappedPixelData,
          result.gridDimensions,
          result.gridSource,
        );
        setStagedUploadSrc(null);
      } catch (error) {
        console.error('图纸识别失败:', error);
        notify(`图纸识别失败：${error instanceof Error ? error.message : String(error)}`);
      } finally {
        setRecognizingPattern(false);
      }
    },
    [applyRecognizedPattern, notify, setRecognizingPattern],
  );

  const clearStagedUpload = useCallback(() => {
    setStagedUploadSrc(null);
  }, []);

  const resolveProcessSource = useCallback(() => {
    const { originalImageSrc, preAiImageSrc } = useEditorStore.getState();
    return stagedUploadSrc || preAiImageSrc || originalImageSrc;
  }, [stagedUploadSrc]);

  /** 重新打开上传处理弹窗（弹窗内可选转像素 / 图纸识别） */
  const startUploadModeProcess = useCallback(() => {
    if (useEditorUiStore.getState().isRecognizingPattern) return;

    const src = resolveProcessSource();
    if (!src) {
      notify('请先上传图片。');
      return;
    }

    openImagePrep(src);
  }, [notify, openImagePrep, resolveProcessSource]);

  const processFile = useCallback(
    (file: File) => {
      if (useEditorUiStore.getState().isRecognizingPattern) return;

      const fileExtension = file.name.split('.').pop()?.toLowerCase();

      if (fileExtension === 'csv') {
        console.log('正在导入CSV文件...');
        importCsvData(file)
          .then(({ mappedPixelData, gridDimensions }) => {
            console.log(`成功导入CSV文件: ${gridDimensions.N}x${gridDimensions.M}`);

            setMappedPixelData(mappedPixelData);
            setGridDimensions(gridDimensions);
            setOriginalImageSrc(null);

            const colorCountsMap: { [key: string]: { count: number; color: string } } = {};
            let totalCount = 0;

            mappedPixelData.forEach((row) => {
              row.forEach((cell) => {
                if (cell && !cell.isExternal) {
                  const colorKey = cell.color.toUpperCase();
                  if (colorCountsMap[colorKey]) {
                    colorCountsMap[colorKey].count++;
                  } else {
                    colorCountsMap[colorKey] = {
                      count: 1,
                      color: cell.color,
                    };
                  }
                  totalCount++;
                }
              });
            });

            setColorCounts(colorCountsMap);
            setTotalBeadCount(totalCount);

            const syntheticImageSrc = generateSyntheticImageFromPixelData(
              mappedPixelData,
              gridDimensions,
            );
            setOriginalImageSrc(syntheticImageSrc);
            setStagedUploadSrc(null);

            setSelectedColor(null);

            setGranularity(gridDimensions.N);
            setGranularityInput(gridDimensions.N.toString());
            setGridHeight(gridDimensions.M);
            setGridHeightInput(gridDimensions.M.toString());
            markGridManuallyEdited();

            notify(
              `成功导入CSV文件！图纸尺寸：${gridDimensions.N}x${gridDimensions.M}，共使用${Object.keys(colorCountsMap).length}种颜色。`,
            );
          })
          .catch((error) => {
            console.error('CSV导入失败:', error);
            notify(`CSV导入失败：${error.message}`);
          });
        return;
      }

      // 暂存后自动打开处理弹窗（弹窗内选择转像素 / 图纸识别）
      fileToDataUrl(file)
        .then((result) => {
          useEditorStore.getState().clearGridManuallyEdited();
          setMappedPixelData(null);
          setGridDimensions(null);
          setColorCounts(null);
          setTotalBeadCount(0);
          setPreviewZoom(1);
          setSelectedColor(null);
          setPreAiImageSrc(null);
          setOriginalImageSrc(null);
          setStagedUploadSrc(result);
          openImagePrep(result);
        })
        .catch((error) => {
          console.error('文件读取失败:', error);
          notify(error instanceof Error ? error.message : '无法读取文件。');
        });
    },
    [
      markGridManuallyEdited,
      notify,
      openImagePrep,
      setMappedPixelData,
      setGridDimensions,
      setColorCounts,
      setTotalBeadCount,
      setOriginalImageSrc,
      setPreAiImageSrc,
      setGranularity,
      setGranularityInput,
      setGridHeight,
      setGridHeightInput,
      setSelectedColor,
      setPreviewZoom,
    ],
  );

  const triggerFileInput = useCallback(() => {
    if (!isMounted) {
      console.warn('组件尚未完全挂载，延迟触发文件选择');
      setTimeout(() => triggerFileInput(), 200);
      return;
    }

    if (useEditorUiStore.getState().isRecognizingPattern) {
      return;
    }

    if (fileInputRef.current) {
      try {
        fileInputRef.current.click();
      } catch (error) {
        console.error('触发文件选择失败:', error);
        setTimeout(() => {
          try {
            fileInputRef.current?.click();
          } catch (retryError) {
            console.error('重试触发文件选择失败:', retryError);
          }
        }, 100);
      }
    } else {
      console.warn('文件输入引用不存在，将在100ms后重试');
      setTimeout(() => {
        if (fileInputRef.current) {
          try {
            fileInputRef.current.click();
          } catch (error) {
            console.error('延迟触发文件选择失败:', error);
          }
        }
      }, 100);
    }
  }, [isMounted]);

  const isSupportedUploadFile = (file: File) => {
    const fileName = file.name.toLowerCase();
    const fileType = file.type.toLowerCase();
    const supportedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
    const supportedCsvTypes = ['text/csv', 'application/csv', 'text/plain'];
    const isImageFile = supportedImageTypes.includes(fileType) || fileType.startsWith('image/');
    const isCsvFile = supportedCsvTypes.includes(fileType) || fileName.endsWith('.csv');
    return { isImageFile, isCsvFile };
  };

  const handleFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        const { isImageFile, isCsvFile } = isSupportedUploadFile(file);
        if (isImageFile || isCsvFile) {
          processFile(file);
        } else {
          notify(
            `不支持的文件类型: ${file.type || '未知'}。请选择 JPG、PNG、GIF 格式的图片文件，或 CSV 数据文件。\n文件名: ${file.name}`,
          );
          console.warn(`Unsupported file type: ${file.type}, file name: ${file.name}`);
        }
      }
      if (event.target) {
        event.target.value = '';
      }
    },
    [notify, processFile],
  );

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();

      try {
        if (event.dataTransfer.files && event.dataTransfer.files[0]) {
          const file = event.dataTransfer.files[0];
          const { isImageFile, isCsvFile } = isSupportedUploadFile(file);

          if (isImageFile || isCsvFile) {
            processFile(file);
          } else {
            notify(
              `不支持的文件类型: ${file.type || '未知'}。请拖放 JPG、PNG、GIF 格式的图片文件，或 CSV 数据文件。\n文件名: ${file.name}`,
            );
            console.warn(`Unsupported file type: ${file.type}, file name: ${file.name}`);
          }
        }
      } catch (error) {
        console.error('处理拖拽文件时发生错误:', error);
        notify('处理文件时发生错误，请重试。');
      }
    },
    [notify, processFile],
  );

  const handleDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const items = event.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            event.preventDefault();
            processFile(file);
          }
          break;
        }
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [processFile]);

  return {
    fileInputRef,
    isMounted,
    triggerFileInput,
    handleFileChange,
    handleDrop,
    handleDragOver,
    processFile,
    stagedUploadSrc,
    clearStagedUpload,
    startUploadModeProcess,
    handleRecognizeRegionConfirm,
  };
}
