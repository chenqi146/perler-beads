import { fullBeadPalette } from '../../domain/palette/fullBeadPalette';
import { convertPaletteToColorSystem } from '../../utils/colorSystemUtils';
import { useEditorStore } from './editorStore';
import type { ImagePrepConfirmMeta } from './imagePrepTypes';

/**
 * 弹窗确认后的参数写回外层设置（用 store 原始 setter，避免触发「改限色就 remap」等副作用）。
 * 色板品牌变更时同步重建 activeBeadPalette，供紧接着的识别/生成使用。
 */
export function applyImagePrepConfirmToStore(meta: ImagePrepConfirmMeta): void {
  const store = useEditorStore.getState();
  const systemChanged = meta.selectedColorSystem !== store.selectedColorSystem;

  store.setKeepAspectRatio(meta.keepAspectRatio);
  store.setMaxColorCount(meta.maxColorCount);
  store.setGranularity(meta.gridWidth);
  store.setGranularityInput(String(meta.gridWidth));
  store.setGridHeight(meta.gridHeight);
  store.setGridHeightInput(String(meta.gridHeight));
  store.setSelectedColorSystem(meta.selectedColorSystem);
  store.setDitheringEnabled(meta.ditheringEnabled);
  store.setPixelationMode(meta.pixelationMode);

  if (systemChanged) {
    const selections = store.customPaletteSelections;
    const filtered =
      Object.keys(selections).length > 0
        ? fullBeadPalette.filter((c) => selections[c.hex.toUpperCase()])
        : fullBeadPalette;
    const base = filtered.length > 0 ? filtered : fullBeadPalette;
    store.setActiveBeadPalette(convertPaletteToColorSystem(base, meta.selectedColorSystem));
  }
}
