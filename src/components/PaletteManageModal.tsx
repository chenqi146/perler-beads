'use client';

import CustomPaletteEditor from './CustomPaletteEditor';
import { Overlay } from './ui/Overlay';
import { useToast } from './ui/ToastProvider';
import { fullBeadPalette } from '../domain/palette/fullBeadPalette';
import { useCustomPaletteIO } from '../stores';
import { useEditorStore } from '../application/editor/editorStore';

type PaletteManageModalProps = {
  open: boolean;
  onClose: () => void;
};

/** 色板管理弹窗：勾选/预设/导入导出，保存后全局生效 */
export function PaletteManageModal({ open, onClose }: PaletteManageModalProps) {
  const toast = useToast();
  const customPaletteSelections = useEditorStore((s) => s.customPaletteSelections);
  const selectedColorSystem = useEditorStore((s) => s.selectedColorSystem);

  const {
    importPaletteInputRef,
    handleSelectionChange,
    handleApplyPreset,
    handleSaveCustomPalette,
    handleExportCustomPalette,
    handleImportPaletteFile,
    triggerImportPalette,
  } = useCustomPaletteIO({
    onAfterSave: () => {
      toast('色板已保存并应用');
      onClose();
    },
  });

  if (!open) return null;

  return (
    <Overlay
      labelledBy="custom-palette-title"
      onClose={onClose}
      placement="center"
      layer="import"
      panelClassName="max-w-2xl w-full max-h-[90vh] p-4"
    >
      <CustomPaletteEditor
        allColors={fullBeadPalette}
        currentSelections={customPaletteSelections}
        onSelectionChange={handleSelectionChange}
        onSaveCustomPalette={handleSaveCustomPalette}
        onClose={onClose}
        onExportCustomPalette={handleExportCustomPalette}
        onImportCustomPalette={triggerImportPalette}
        onApplyPreset={handleApplyPreset}
        selectedColorSystem={selectedColorSystem}
      />
      <input
        ref={importPaletteInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={handleImportPaletteFile}
      />
    </Overlay>
  );
}
