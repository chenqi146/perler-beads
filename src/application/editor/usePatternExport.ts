'use client';

import { useCallback, useMemo, useState } from 'react';
import { gridLineColorOptions } from '../../components/DownloadSettingsModal';
import type { GridDownloadOptions } from '../../types/downloadTypes';
import { downloadImage, exportCsvData } from '../../utils/imageDownloader';
import { generateIngredientBill, type IngredientBill } from '../../utils/ingredientEngine';
import { useEditorStore } from './editorStore';

const defaultDownloadOptions: GridDownloadOptions = {
  showGrid: true,
  gridInterval: 10,
  showCoordinates: true,
  showCellNumbers: true,
  gridLineColor: gridLineColorOptions[0].value,
  includeStats: true,
  exportCsv: false,
};

/** 图纸导出预览 / 下载 + 用料单 */
export function usePatternExport() {
  const mappedPixelData = useEditorStore((s) => s.mappedPixelData);
  const gridDimensions = useEditorStore((s) => s.gridDimensions);
  const colorCounts = useEditorStore((s) => s.colorCounts);
  const totalBeadCount = useEditorStore((s) => s.totalBeadCount);
  const activeBeadPalette = useEditorStore((s) => s.activeBeadPalette);
  const selectedColorSystem = useEditorStore((s) => s.selectedColorSystem);

  const [isDownloadSettingsOpen, setIsDownloadSettingsOpen] = useState(false);
  const [exportPreviewUrl, setExportPreviewUrl] = useState<string | null>(null);
  const [exportPreviewFilename, setExportPreviewFilename] = useState('');
  const [isExportPreviewLoading, setIsExportPreviewLoading] = useState(false);
  const [downloadOptions, setDownloadOptions] =
    useState<GridDownloadOptions>(defaultDownloadOptions);
  const [isIngredientBillOpen, setIsIngredientBillOpen] = useState(false);

  const closeExportDialog = useCallback(() => {
    setIsDownloadSettingsOpen(false);
    setExportPreviewUrl(null);
    setExportPreviewFilename('');
    setIsExportPreviewLoading(false);
  }, []);

  /** 按弹窗里的参数生成预览，不直接下载 */
  const handlePreviewExport = useCallback(
    async (options: GridDownloadOptions) => {
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
    },
    [
      mappedPixelData,
      gridDimensions,
      colorCounts,
      totalBeadCount,
      activeBeadPalette,
      selectedColorSystem,
    ],
  );

  const handleConfirmExportDownload = useCallback(
    (options?: GridDownloadOptions) => {
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
    },
    [exportPreviewUrl, exportPreviewFilename, mappedPixelData, gridDimensions, selectedColorSystem],
  );

  const ingredientBill = useMemo<IngredientBill | null>(() => {
    if (!mappedPixelData || !gridDimensions) return null;
    return generateIngredientBill(mappedPixelData, selectedColorSystem, {
      cols: gridDimensions.N,
      rows: gridDimensions.M,
    });
  }, [mappedPixelData, gridDimensions, selectedColorSystem]);

  return {
    isDownloadSettingsOpen,
    setIsDownloadSettingsOpen,
    downloadOptions,
    setDownloadOptions,
    exportPreviewUrl,
    exportPreviewFilename,
    isExportPreviewLoading,
    closeExportDialog,
    handlePreviewExport,
    handleConfirmExportDownload,
    isIngredientBillOpen,
    setIsIngredientBillOpen,
    ingredientBill,
  };
}
