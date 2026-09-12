import { hexToRgb, type PaletteColor } from '../pixelation/pixelation';
import { getMardToHexMapping } from './colorSystemUtils';

/** 全量拼豆色板（MARD → hex → rgb），模块级一次构建 */
export const fullBeadPalette: PaletteColor[] = Object.entries(getMardToHexMapping())
  .map(([mardKey, hex]) => {
    const rgb = hexToRgb(hex);
    if (!rgb) {
      console.warn(`Invalid hex code "${hex}" for MARD key "${mardKey}". Skipping.`);
      return null;
    }
    // 使用 hex 值作为 key，符合新的架构设计
    return { key: hex, hex, rgb };
  })
  .filter((color): color is PaletteColor => color !== null);
