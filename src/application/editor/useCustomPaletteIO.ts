'use client';

import { useCallback, useRef, type ChangeEvent } from 'react';
import { fullBeadPalette } from '../../domain/palette/fullBeadPalette';
import { presetToSelections } from '../../domain/palette/paletteSelections';
import { savePaletteSelections } from '../../infrastructure/storage/paletteSelectionsRepository';
import { useEditorStore } from './editorStore';

type UseCustomPaletteIOOptions = {
  onAfterSave?: () => void;
};

/** 自定义色板：勾选变更、保存、导入/导出 JSON */
export function useCustomPaletteIO({ onAfterSave }: UseCustomPaletteIOOptions = {}) {
  const customPaletteSelections = useEditorStore((s) => s.customPaletteSelections);
  const setCustomPaletteSelections = useEditorStore((s) => s.setCustomPaletteSelections);
  const setRemapTrigger = useEditorStore((s) => s.setRemapTrigger);
  const setSelectedColor = useEditorStore((s) => s.setSelectedColor);

  const importPaletteInputRef = useRef<HTMLInputElement>(null);

  const handleSelectionChange = useCallback(
    (hexValue: string, isSelected: boolean) => {
      setCustomPaletteSelections((prev) => ({
        ...prev,
        [hexValue.toUpperCase()]: isSelected,
      }));
    },
    [setCustomPaletteSelections],
  );

  const handleSaveCustomPalette = useCallback(() => {
    savePaletteSelections(customPaletteSelections);
    onAfterSave?.();
    setRemapTrigger((prev) => prev + 1);
    setSelectedColor(null);
  }, [
    customPaletteSelections,
    onAfterSave,
    setRemapTrigger,
    setSelectedColor,
  ]);

  const handleExportCustomPalette = useCallback(() => {
    const selectedHexValues = Object.entries(customPaletteSelections)
      .filter(([, isSelected]) => isSelected)
      .map(([hexValue]) => hexValue);

    if (selectedHexValues.length === 0) {
      alert('当前没有选中的颜色，无法导出。');
      return;
    }

    const exportData = {
      version: '3.0',
      selectedHexValues,
      exportDate: new Date().toISOString(),
      totalColors: selectedHexValues.length,
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
  }, [customPaletteSelections]);

  const handleImportPaletteFile = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const data = JSON.parse(content);

          if (!Array.isArray(data.selectedHexValues)) {
            throw new Error("无效的文件格式：文件必须包含 'selectedHexValues' 数组。");
          }

          const importedHexValues = data.selectedHexValues as string[];
          const validHexValues: string[] = [];
          const invalidHexValues: string[] = [];

          importedHexValues.forEach((hex) => {
            const normalizedHex = hex.toUpperCase();
            const colorData = fullBeadPalette.find((color) => color.hex.toUpperCase() === normalizedHex);
            if (colorData) validHexValues.push(normalizedHex);
            else invalidHexValues.push(hex);
          });

          if (invalidHexValues.length > 0) {
            alert(`导入完成，但以下颜色无效已被忽略：\n${invalidHexValues.join(', ')}`);
          }

          if (validHexValues.length === 0) {
            alert('导入的文件中不包含任何有效的颜色。');
            return;
          }

          const allHexValues = fullBeadPalette.map((color) => color.hex.toUpperCase());
          setCustomPaletteSelections(presetToSelections(allHexValues, validHexValues));
          alert(`成功导入 ${validHexValues.length} 个颜色！`);
        } catch (error) {
          console.error('导入色板配置失败:', error);
          alert(`导入失败: ${error instanceof Error ? error.message : '未知错误'}`);
        } finally {
          if (event.target) event.target.value = '';
        }
      };
      reader.onerror = () => {
        alert('读取文件失败。');
        if (event.target) event.target.value = '';
      };
      reader.readAsText(file);
    },
    [setCustomPaletteSelections],
  );

  const triggerImportPalette = useCallback(() => {
    importPaletteInputRef.current?.click();
  }, []);

  return {
    importPaletteInputRef,
    handleSelectionChange,
    handleSaveCustomPalette,
    handleExportCustomPalette,
    handleImportPaletteFile,
    triggerImportPalette,
  };
}
