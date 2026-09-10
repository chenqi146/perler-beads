const STORAGE_KEY = 'customPerlerPaletteSelections';

export interface PaletteSelections {
  [hexValue: string]: boolean;
}

/**
 * 保存自定义色板选择状态到localStorage
 */
export function savePaletteSelections(selections: PaletteSelections): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(selections));
  } catch (error) {
    console.error("无法保存色板选择到本地存储:", error);
  }
}

/**
 * 从localStorage加载自定义色板选择状态
 */
export function loadPaletteSelections(): PaletteSelections | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error("无法从本地存储加载色板选择:", error);
    localStorage.removeItem(STORAGE_KEY); // 清除无效数据
  }
  return null;
}

/**
 * 将预设色板转换为选择状态对象（基于hex值）
 */
export function presetToSelections(allHexValues: string[], presetHexValues: string[]): PaletteSelections {
  const presetSet = new Set(presetHexValues.map(hex => hex.toUpperCase()));
  const selections: PaletteSelections = {};
  
  allHexValues.forEach(hex => {
    const normalizedHex = hex.toUpperCase();
    selections[normalizedHex] = presetSet.has(normalizedHex);
  });
  
  return selections;
}

/**
 * 根据MARD色号预设生成基于hex值的选择状态（用于兼容旧预设）
 */
export function presetKeysToHexSelections(
  allBeadPalette: Array<{key: string, hex: string}>, 
  presetKeys: string[]
): PaletteSelections {
  const presetKeySet = new Set(presetKeys);
  const selections: PaletteSelections = {};
  const processedHexValues = new Set<string>();
  
  console.log(`presetKeysToHexSelections: 输入调色板大小 ${allBeadPalette.length}, 预设键数量 ${presetKeys.length}`);
  
  allBeadPalette.forEach(color => {
    const normalizedHex = color.hex.toUpperCase();
    
    // 检查是否已经处理过这个hex值
    if (processedHexValues.has(normalizedHex)) {
      console.warn(`重复的hex值: ${normalizedHex}, MARD键: ${color.key}`);
      return; // 跳过重复的hex值
    }
    
    processedHexValues.add(normalizedHex);
    selections[normalizedHex] = presetKeySet.has(color.key);
  });
  
  const selectedCount = Object.values(selections).filter(Boolean).length;
  console.log(`presetKeysToHexSelections: 生成选择对象，总数 ${Object.keys(selections).length}, 选中 ${selectedCount}`);
  
  return selections;
}

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
  excludedColorKeys: string[];
  initialGridColorKeys: string[];
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
    // QuotaExceeded：去掉原图再试
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
