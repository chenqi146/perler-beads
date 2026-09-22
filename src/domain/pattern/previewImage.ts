import { generateSyntheticImageFromPixelData } from '../pixelation/syntheticImage';
import { assertPatternHasGrid, type PatternData } from './types';

/** 列表/编辑用展示图：优先原图，否则由格子数据合成（不写入 localStorage） */
export function resolvePatternImageSrc(data: PatternData): string | null {
  if (typeof data.originalImageSrc === 'string' && data.originalImageSrc.length > 0) {
    return data.originalImageSrc;
  }
  if (typeof window === 'undefined') return null;
  if (!assertPatternHasGrid(data)) return null;
  const url = generateSyntheticImageFromPixelData(data.mappedPixelData, data.gridDimensions);
  return url || null;
}
