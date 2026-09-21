export {
  PixelationMode,
  calculatePixelGrid,
  calculateCellRepresentativeColor,
  enhanceImageDataForSmallGrid,
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

export {
  majorityFilter,
  removeIsolatedNoise,
  cleanupPixelGrid,
} from './patternCleanup';

export {
  extractStrokeMask,
  sampleStrokeCellColor,
  thickenDarkStrokes,
} from './strokeExtract';

export { generateSyntheticImageFromPixelData } from './syntheticImage';
