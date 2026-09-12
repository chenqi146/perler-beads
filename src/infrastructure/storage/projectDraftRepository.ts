/** 当前图纸草稿（改色等编辑自动保存） */
const PROJECT_DRAFT_KEY = 'perlerBeads_projectDraft_v1';

export interface ProjectDraftV1 {
  version: 1;
  savedAt: number;
  mappedPixelData: Array<Array<{ key: string; color: string; isExternal?: boolean }>>;
  gridDimensions: { N: number; M: number };
  colorCounts: { [hex: string]: { count: number; color: string } } | null;
  totalBeadCount: number;
  originalImageSrc: string | null;
  granularity: number;
  gridHeight: number;
  similarityThreshold: number;
  maxColorCount: number;
  autoRemoveWhiteBg: boolean;
  pixelationMode: string;
  selectedColorSystem: string;
  /** @deprecated 旧草稿可能仍含此字段，加载时忽略 */
  excludedColorKeys?: string[];
  /** @deprecated 旧草稿可能仍含此字段，加载时忽略 */
  initialGridColorKeys?: string[];
}

export type SaveProjectDraftResult =
  | { ok: true; withOriginal: boolean }
  | { ok: false; reason: string };

/**
 * 自动保存当前图纸到 localStorage。
 * 若包含原图导致配额不足，会降级为不保存原图（仍可恢复格子数据）。
 */
export function saveProjectDraft(draft: ProjectDraftV1): SaveProjectDraftResult {
  try {
    localStorage.setItem(PROJECT_DRAFT_KEY, JSON.stringify(draft));
    return { ok: true, withOriginal: !!draft.originalImageSrc };
  } catch (err) {
    if (draft.originalImageSrc) {
      try {
        const slim: ProjectDraftV1 = { ...draft, originalImageSrc: null };
        localStorage.setItem(PROJECT_DRAFT_KEY, JSON.stringify(slim));
        return { ok: true, withOriginal: false };
      } catch (err2) {
        console.error('无法保存图纸草稿:', err2);
        return { ok: false, reason: '浏览器存储空间不足' };
      }
    }
    console.error('无法保存图纸草稿:', err);
    return { ok: false, reason: '保存失败' };
  }
}

export function loadProjectDraft(): ProjectDraftV1 | null {
  try {
    const raw = localStorage.getItem(PROJECT_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ProjectDraftV1;
    if (!parsed || parsed.version !== 1 || !parsed.mappedPixelData || !parsed.gridDimensions) {
      return null;
    }
    return parsed;
  } catch (error) {
    console.error('无法加载图纸草稿:', error);
    return null;
  }
}

export function clearProjectDraft(): void {
  try {
    localStorage.removeItem(PROJECT_DRAFT_KEY);
  } catch {
    // ignore
  }
}
