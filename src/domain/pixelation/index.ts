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
export type {
  RgbColor,
  PaletteColor,
  MappedPixel,
  ColorSystem,
  CalculatePixelGridOptions,
} from './pixelation';

export { applyFloydSteinbergDither } from './dithering';
export type { DitheringMode } from './dithering';

export { adjustImageData, normalizeImageAdjust } from './imageAdjust';
export type { ImageAdjustOptions } from './imageAdjust';

export { detectSubjectBounds } from './subjectCrop';
export type {
  SubjectBackgroundMode,
  SubjectCropOptions,
  SubjectBounds,
} from './subjectCrop';

export {
  CREATIVE_PRESETS,
  CREATIVE_PRESET_ORDER,
  matchCreativePreset,
} from './creativePreset';
export type { CreativePresetId, CreativePresetConfig } from './creativePreset';

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
  scalePixelGrid,
  mergeRareColors,
  isSmallPixelGrid,
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
