import type { MappedPixel } from '../domain/pixelation';
import type {
  Pattern,
  PatternData,
  Visibility,
  CraftStatus,
} from '../domain/pattern';

export type { Pattern, PatternData, Visibility, CraftStatus };

export interface CraftSession {
  id: string;
  patternId: string;
  ownerId: string;
  patternSnapshot: PatternData;
  completedCells: string[];
  elapsedSeconds: number;
  status: CraftStatus;
  createdAt: number;
  updatedAt: number;
}

export interface Work {
  id: string;
  patternId: string;
  craftSessionId: string;
  ownerId: string;
  title: string;
  description: string;
  tags: string[];
  imageUrl: string;
  visibility: Visibility;
  createdAt: number;
}

/** @deprecated 使用 domain MappedPixel；保留以免零散引用断裂 */
export type { MappedPixel };
