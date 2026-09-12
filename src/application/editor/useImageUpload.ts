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
import { useEditorStore } from './editorStore';
import { useEditorUiStore } from './editorUiStore';

export type UseImageUploadOptions = {
  openImagePrep: (imageSrc: string) => void;
  /** 预留：上传路径当前多用 alert；与其它 editor hooks 对齐 */
  showToast?: (msg: string) => void;
};

/** 图片 / CSV 上传、拖放、粘贴与文件选择触发 */
export function useImageUpload({ openImagePrep }: UseImageUploadOptions) {
  const setMappedPixelData = useEditorStore((s) => s.setMappedPixelData);
  const setGridDimensions = useEditorStore((s) => s.setGridDimensions);
  const setColorCounts = useEditorStore((s) => s.setColorCounts);
  const setTotalBeadCount = useEditorStore((s) => s.setTotalBeadCount);
  const setOriginalImageSrc = useEditorStore((s) => s.setOriginalImageSrc);
  const setPreAiImageSrc = useEditorStore((s) => s.setPreAiImageSrc);
  const setGranularity = useEditorStore((s) => s.setGranularity);
  const setGranularityInput = useEditorStore((s) => s.setGranularityInput);
  const setSelectedColor = useEditorStore((s) => s.setSelectedColor);

  const setPreviewZoom = useEditorUiStore((s) => s.setPreviewZoom);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isMounted, setIsMounted] = useState(false);

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

  const processFile = useCallback(
    (file: File) => {
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

            setSelectedColor(null);

            setGranularity(gridDimensions.N);
            setGranularityInput(gridDimensions.N.toString());

            alert(
              `成功导入CSV文件！图纸尺寸：${gridDimensions.N}x${gridDimensions.M}，共使用${Object.keys(colorCountsMap).length}种颜色。`,
            );
          })
          .catch((error) => {
            console.error('CSV导入失败:', error);
            alert(`CSV导入失败：${error.message}`);
          });
      } else {
        const applyImageSrc = (result: string) => {
          setMappedPixelData(null);
          setGridDimensions(null);
          setColorCounts(null);
          setTotalBeadCount(0);
          setPreviewZoom(1);
          setSelectedColor(null);
          setPreAiImageSrc(null);
          setOriginalImageSrc(null);
          openImagePrep(result);
        };

        const isGif = file.type === 'image/gif' || file.name.toLowerCase().endsWith('.gif');

        if (isGif) {
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
            });
        } else {
          const reader = new FileReader();
          reader.onload = (e) => {
            applyImageSrc(e.target?.result as string);
          };
          reader.onerror = () => {
            console.error('文件读取失败');
            alert('无法读取文件。');
          };
          reader.readAsDataURL(file);
        }

        setSelectedColor(null);
      }
    },
    [
      openImagePrep,
      setMappedPixelData,
      setGridDimensions,
      setColorCounts,
      setTotalBeadCount,
      setOriginalImageSrc,
      setPreAiImageSrc,
      setGranularity,
      setGranularityInput,
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
          alert(
            `不支持的文件类型: ${file.type || '未知'}。请选择 JPG、PNG、GIF 格式的图片文件，或 CSV 数据文件。\n文件名: ${file.name}`,
          );
          console.warn(`Unsupported file type: ${file.type}, file name: ${file.name}`);
        }
      }
      if (event.target) {
        event.target.value = '';
      }
    },
    [processFile],
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
            alert(
              `不支持的文件类型: ${file.type || '未知'}。请拖放 JPG、PNG、GIF 格式的图片文件，或 CSV 数据文件。\n文件名: ${file.name}`,
            );
            console.warn(`Unsupported file type: ${file.type}, file name: ${file.name}`);
          }
        }
      } catch (error) {
        console.error('处理拖拽文件时发生错误:', error);
        alert('处理文件时发生错误，请重试。');
      }
    },
    [processFile],
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
  };
}
