import type { MappedPixel } from '../pixelation';

export type Visibility = 'private' | 'public';
export type CraftStatus = 'active' | 'completed' | 'paused';

/** 图纸像素快照（领域实体的数据部分） */
export interface PatternData {
  mappedPixelData: MappedPixel[][];
  gridDimensions: { N: number; M: number };
  colorCounts: Record<string, { count: number; color: string }> | null;
  totalBeadCount: number;
  originalImageSrc: string | null;
  selectedColorSystem: string;
}

/** 图纸聚合根 */
export interface Pattern {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  tags: string[];
  visibility: Visibility;
  data: PatternData;
  createdAt: number;
  updatedAt: number;
}

export type PatternInput = Pick<Pattern, 'name' | 'description' | 'tags' | 'visibility' | 'data'>;

export function assertPatternHasGrid(data: PatternData): boolean {
  return Boolean(data.mappedPixelData?.length && data.gridDimensions?.N > 0 && data.gridDimensions?.M > 0);
}
