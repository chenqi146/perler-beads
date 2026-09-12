/**
 * 色板领域：色号体系与映射、选择状态纯逻辑（无持久化）。
 */
export {
  colorSystemOptions,
  getAllHexValues,
  getMardToHexMapping,
  loadFullColorMapping,
  convertPaletteToColorSystem,
  getDisplayColorKey,
  convertColorKeyToHex,
  isValidColorInSystem,
  getColorKeyByHex,
  sortColorsByHue,
} from './colorSystemUtils';
export type { ColorSystem } from './colorSystemUtils';
export {
  presetToSelections,
  presetKeysToHexSelections,
} from './paletteSelections';
export type { PaletteSelections } from './paletteSelections';
export { fullBeadPalette } from './fullBeadPalette';
