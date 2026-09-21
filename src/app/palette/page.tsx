'use client';

import { useEffect, useState } from 'react';
import RequireAuth from '../../components/RequireAuth';
import CustomPaletteEditor from '../../components/CustomPaletteEditor';
import { useAppNavSubtitle } from '../../components/shell';
import { useToast } from '../../components/ui/ToastProvider';
import { fullBeadPalette } from '../../domain/palette/fullBeadPalette';
import {
  selectionsFromPreset,
  DEFAULT_PALETTE_PRESET_ID,
  colorSystemOptions,
  type ColorSystem,
} from '../../domain/palette';
import { useCustomPaletteIO } from '../../stores';
import { useEditorStore } from '../../application/editor/editorStore';

function PalettePageContent() {
  const toast = useToast();
  useAppNavSubtitle('色板管理');

  const customPaletteSelections = useEditorStore((s) => s.customPaletteSelections);
  const setCustomPaletteSelections = useEditorStore((s) => s.setCustomPaletteSelections);
  const selectedColorSystem = useEditorStore((s) => s.selectedColorSystem);
  const setSelectedColorSystem = useEditorStore((s) => s.setSelectedColorSystem);
  const [ready, setReady] = useState(false);

  const {
    importPaletteInputRef,
    handleSelectionChange,
    handleApplyPreset,
    handleSaveCustomPalette,
    handleExportCustomPalette,
    handleImportPaletteFile,
    triggerImportPalette,
  } = useCustomPaletteIO({
    onAfterSave: () => toast('色板已保存并应用'),
  });

  useEffect(() => {
    const allHex = fullBeadPalette.map((c) => c.hex.toUpperCase());
    useEditorStore.getState().hydratePaletteSelections();
    // 若水合后仍无选中项，补默认预设（避免色板页空白）
    const sels = useEditorStore.getState().customPaletteSelections;
    const selected = Object.values(sels).filter(Boolean).length;
    if (selected === 0) {
      setCustomPaletteSelections(selectionsFromPreset(DEFAULT_PALETTE_PRESET_ID));
    } else if (Object.keys(sels).length < allHex.length) {
      const valid: Record<string, boolean> = {};
      for (const hex of allHex) {
        valid[hex] = sels[hex] === true;
      }
      setCustomPaletteSelections(valid);
    }
    setReady(true);
  }, [setCustomPaletteSelections]);

  if (!ready) {
    return <p className="empty-state">加载色板…</p>;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
      <div className="shrink-0 rounded-2xl border border-[#eadfce] bg-[#fffaf3] px-4 py-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-[#3a2416]">色板管理</h1>
            <p className="mt-0.5 text-xs text-[#8a6a4a]">
              选择默认配置或自定义勾选，保存后全局生效（图纸生成会使用当前色板）
            </p>
          </div>
          <label className="flex items-center gap-2 text-xs text-[#5c4030]">
            <span className="whitespace-nowrap">色号品牌</span>
            <select
              value={selectedColorSystem}
              onChange={(e) => setSelectedColorSystem(e.target.value as ColorSystem)}
              className="h-9 rounded-lg border border-[#e0d0bc] bg-white px-2 text-sm"
            >
              {colorSystemOptions.map((opt) => (
                <option key={opt.key} value={opt.key}>
                  {opt.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-[#eadfce] bg-white p-4 shadow-sm">
        <CustomPaletteEditor
          embedded
          allColors={fullBeadPalette}
          currentSelections={customPaletteSelections}
          onSelectionChange={handleSelectionChange}
          onSaveCustomPalette={handleSaveCustomPalette}
          onExportCustomPalette={handleExportCustomPalette}
          onImportCustomPalette={triggerImportPalette}
          onApplyPreset={handleApplyPreset}
          selectedColorSystem={selectedColorSystem}
        />
      </div>

      <input
        ref={importPaletteInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={handleImportPaletteFile}
      />
    </div>
  );
}

export default function PalettePage() {
  return (
    <RequireAuth>
      <PalettePageContent />
    </RequireAuth>
  );
}
