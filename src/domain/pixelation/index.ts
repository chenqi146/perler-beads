/**
 * 像素化领域：纯算法（网格计算、编辑、洪水填充）。
 */
export {
  PixelationMode,
  calculatePixelGrid,
  hexToRgb,
  colorDistance,
  colorDistanceOklab,
  findClosestPaletteColor,
} from './pixelation';
export type { RgbColor, PaletteColor, MappedPixel, ColorSystem } from './pixelation';

export {
  TRANSPARENT_KEY,
  transparentColorData,
  floodFillErase,
  replaceColor,
  paintSinglePixel,
  recalculateColorStats,
} from './pixelEditingUtils';

export {
  getConnectedRegion,
  getAllConnectedRegions,
  isRegionCompleted,
  isRegionPartiallyCompleted,
  getRegionCenter,
  sortRegionsByDistance,
  sortRegionsBySize,
  getRegionEdgeDistance,
  sortRegionsByEdge,
} from './floodFillUtils';

export {
  limitColorCount,
  removeEdgeBackground,
  recountColors,
  cropPixelGrid,
  autoCropPixelGrid,
} from './colorLimitUtils';

export { generateSyntheticImageFromPixelData } from './syntheticImage';
