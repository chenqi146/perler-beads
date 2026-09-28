import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { MappedPixel } from '../../domain/pixelation';
import type { BeadCraftPhase } from './beadProgressSummary';

export type PatternBeadProgress = {
  completedCells: string[];
  /** 兼容旧数据；权威以 cells 为准，也可在整色勾选时写入 */
  completedColors?: string[];
  /** 用户手动设定的拼豆阶段（暂停等）；与格子同步后可清除 */
  manualStatus?: BeadCraftPhase;
};

type BeadProgressState = {
  byPattern: Record<string, PatternBeadProgress>;
  getCells: (patternId: string) => string[];
  /** 派生或缓存的完成色（大写 hex） */
  getCompletedColors: (patternId: string) => string[];
  toggleCell: (patternId: string, cellKey: string) => { cells: string[]; added: boolean };
  /** 仅标记完成，不取消（拼豆点格用） */
  markCell: (patternId: string, cellKey: string) => { cells: string[]; added: boolean };
  setCells: (patternId: string, cells: string[]) => void;
  /** 整色完成：将该色所有非外部格写入 / 移除 completedCells */
  setColorCompleted: (
    patternId: string,
    hexKey: string,
    completed: boolean,
    mappedPixelData: MappedPixel[][] | null,
  ) => string[];
  /**
   * 手动改拼豆状态：未开始会清空格子；已完成会标记全部内部格。
   * 需传入 mappedPixelData 才能正确同步格子。
   */
  setCraftStatus: (
    patternId: string,
    status: BeadCraftPhase,
    mappedPixelData: MappedPixel[][] | null,
  ) => void;
  /** 云端回填：写入格子与手动状态，不走 setCraftStatus 的清空/全标逻辑 */
  hydrateFromRemote: (
    patternId: string,
    payload: { completedCells: string[]; manualStatus: BeadCraftPhase },
  ) => void;
  clearPattern: (patternId: string) => void;
};

const LEGACY_KEY = 'perler-bead-progress-v1';
const STORE_KEY = 'perler-bead-progress-store-v1';
const EMPTY_CELLS: string[] = [];
const EMPTY_COLORS: string[] = [];
const CRAFT_PHASES: BeadCraftPhase[] = [
  'not_started',
  'in_progress',
  'paused',
  'completed',
];

function cellKey(row: number, col: number): string {
  return `${row},${col}`;
}

function normalizeManualStatus(value: unknown): BeadCraftPhase | undefined {
  if (typeof value !== 'string') return undefined;
  return CRAFT_PHASES.includes(value as BeadCraftPhase)
    ? (value as BeadCraftPhase)
    : undefined;
}

function normalizeProgress(raw: unknown): PatternBeadProgress {
  if (Array.isArray(raw)) {
    // 旧版：仅 completedColors hex 列表
    return {
      completedCells: [],
      completedColors: raw.map((c) => String(c).toUpperCase()),
    };
  }
  if (raw && typeof raw === 'object') {
    const obj = raw as PatternBeadProgress & { completedColors?: string[] };
    return {
      completedCells: Array.isArray(obj.completedCells)
        ? obj.completedCells.map(String)
        : [],
      completedColors: Array.isArray(obj.completedColors)
        ? obj.completedColors.map((c) => String(c).toUpperCase())
        : undefined,
      manualStatus: normalizeManualStatus(obj.manualStatus),
    };
  }
  return { completedCells: [] };
}

function collectColorCells(mappedPixelData: MappedPixel[][], hexKey: string): string[] {
  const target = hexKey.toUpperCase();
  const keys: string[] = [];
  for (let r = 0; r < mappedPixelData.length; r++) {
    const row = mappedPixelData[r];
    if (!row) continue;
    for (let c = 0; c < row.length; c++) {
      const cell = row[c];
      if (!cell || cell.isExternal) continue;
      if ((cell.color || '').toUpperCase() === target) keys.push(cellKey(r, c));
    }
  }
  return keys;
}

function collectAllInternalCells(mappedPixelData: MappedPixel[][]): string[] {
  const keys: string[] = [];
  for (let r = 0; r < mappedPixelData.length; r++) {
    const row = mappedPixelData[r];
    if (!row) continue;
    for (let c = 0; c < row.length; c++) {
      const cell = row[c];
      if (cell && !cell.isExternal) keys.push(cellKey(r, c));
    }
  }
  return keys;
}

/** 点格后收敛手动状态，避免与真实进度长期冲突 */
function afterCellEdit(
  entry: PatternBeadProgress,
  cells: string[],
): PatternBeadProgress {
  const manual = entry.manualStatus;
  if (!manual) {
    return {
      completedCells: cells,
      completedColors: entry.completedColors,
    };
  }

  if (manual === 'paused') {
    return {
      completedCells: cells,
      completedColors: entry.completedColors,
      manualStatus: 'in_progress',
    };
  }
  if (manual === 'not_started' && cells.length > 0) {
    return {
      completedCells: cells,
      completedColors: entry.completedColors,
      manualStatus: undefined,
    };
  }
  if (manual === 'completed') {
    return {
      completedCells: cells,
      completedColors: entry.completedColors,
      manualStatus: undefined,
    };
  }
  return {
    completedCells: cells,
    completedColors: entry.completedColors,
    manualStatus: manual,
  };
}

/** 由格子推导某色是否全部完成 */
export function isColorFullyCompleted(
  mappedPixelData: MappedPixel[][],
  hexKey: string,
  completedCells: Set<string>,
): boolean {
  const cells = collectColorCells(mappedPixelData, hexKey);
  if (cells.length === 0) return false;
  return cells.every((k) => completedCells.has(k));
}

export function deriveCompletedColors(
  mappedPixelData: MappedPixel[][] | null,
  colorHexes: string[],
  completedCells: string[],
  legacyColors?: string[],
): string[] {
  const cellSet = new Set(completedCells);
  const fromCells =
    mappedPixelData && mappedPixelData.length > 0
      ? colorHexes.filter((hex) => isColorFullyCompleted(mappedPixelData, hex, cellSet))
      : [];
  const legacy = (legacyColors ?? []).map((c) => c.toUpperCase());
  // 无格子数据时保留 legacy；有格子时以 cells 为准，同时保留「整色勾选但尚无像素」的 legacy 并集在无 mapped 时
  if (!mappedPixelData || mappedPixelData.length === 0) {
    return Array.from(new Set(legacy));
  }
  // 整色勾选过、但用户尚未点格时：若 completedColors 含该色且 cells 为空对该色，仍算完成（迁移期）
  const derived = new Set(fromCells.map((c) => c.toUpperCase()));
  for (const hex of legacy) {
    const colorCells = collectColorCells(mappedPixelData, hex);
    if (colorCells.length === 0) {
      derived.add(hex);
      continue;
    }
    // 若 legacy 标记完成且尚未有任何该色格子被点，视为整色完成（兼容旧勾选）
    const anyCell = colorCells.some((k) => cellSet.has(k));
    if (!anyCell) derived.add(hex);
  }
  return Array.from(derived);
}

function readLegacyByPattern(): Record<string, PatternBeadProgress> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (parsed && typeof parsed === 'object' && 'state' in parsed) return {};
    const byPattern: Record<string, PatternBeadProgress> = {};
    for (const [id, value] of Object.entries(parsed)) {
      byPattern[id] = normalizeProgress(value);
    }
    return byPattern;
  } catch {
    return {};
  }
}

function migrateByPattern(
  byPattern: Record<string, PatternBeadProgress | string[] | unknown>,
): Record<string, PatternBeadProgress> {
  const next: Record<string, PatternBeadProgress> = {};
  for (const [id, value] of Object.entries(byPattern || {})) {
    next[id] = normalizeProgress(value);
  }
  return next;
}

export const useBeadProgressStore = create<BeadProgressState>()(
  persist(
    (set, get) => ({
      byPattern: {},

      getCells: (patternId) => get().byPattern[patternId]?.completedCells ?? EMPTY_CELLS,

      getCompletedColors: (patternId) => {
        const entry = get().byPattern[patternId];
        if (!entry) return EMPTY_COLORS;
        return (entry.completedColors ?? []).map((c) => c.toUpperCase());
      },

      toggleCell: (patternId, key) => {
        const entry = get().byPattern[patternId] ?? { completedCells: [] };
        const setCells = new Set(entry.completedCells);
        const added = !setCells.has(key);
        if (added) setCells.add(key);
        else setCells.delete(key);
        const cells = Array.from(setCells);
        set((state) => ({
          byPattern: {
            ...state.byPattern,
            [patternId]: afterCellEdit(
              {
                completedCells: cells,
                completedColors: entry.completedColors,
                manualStatus: entry.manualStatus,
              },
              cells,
            ),
          },
        }));
        return { cells, added };
      },

      markCell: (patternId, key) => {
        const entry = get().byPattern[patternId] ?? { completedCells: [] };
        if (entry.completedCells.includes(key)) {
          return { cells: entry.completedCells, added: false };
        }
        const cells = [...entry.completedCells, key];
        set((state) => ({
          byPattern: {
            ...state.byPattern,
            [patternId]: afterCellEdit(
              {
                completedCells: cells,
                completedColors: entry.completedColors,
                manualStatus: entry.manualStatus,
              },
              cells,
            ),
          },
        }));
        return { cells, added: true };
      },

      setCells: (patternId, cells) =>
        set((state) => {
          const entry = state.byPattern[patternId] ?? { completedCells: [] };
          return {
            byPattern: {
              ...state.byPattern,
              [patternId]: afterCellEdit(
                {
                  completedCells: cells,
                  completedColors: entry.completedColors,
                  manualStatus: entry.manualStatus,
                },
                cells,
              ),
            },
          };
        }),

      setColorCompleted: (patternId, hexKey, completed, mappedPixelData) => {
        const normalized = hexKey.toUpperCase();
        const entry = get().byPattern[patternId] ?? { completedCells: [] };
        const cellSet = new Set(entry.completedCells);
        const colorCells = mappedPixelData ? collectColorCells(mappedPixelData, normalized) : [];

        if (completed) {
          colorCells.forEach((k) => cellSet.add(k));
        } else {
          colorCells.forEach((k) => cellSet.delete(k));
        }

        const legacy = new Set((entry.completedColors ?? []).map((c) => c.toUpperCase()));
        if (completed) legacy.add(normalized);
        else legacy.delete(normalized);

        const cells = Array.from(cellSet);
        const completedColors = Array.from(legacy);
        set((state) => ({
          byPattern: {
            ...state.byPattern,
            [patternId]: afterCellEdit(
              { completedCells: cells, completedColors, manualStatus: entry.manualStatus },
              cells,
            ),
          },
        }));
        return completedColors;
      },

      setCraftStatus: (patternId, status, mappedPixelData) => {
        const entry = get().byPattern[patternId] ?? { completedCells: [] };
        let cells = entry.completedCells;
        let completedColors = entry.completedColors;
        let manualStatus: BeadCraftPhase = status;

        if (status === 'not_started') {
          cells = [];
          completedColors = undefined;
          manualStatus = 'not_started';
        } else if (status === 'completed') {
          if (mappedPixelData?.length) {
            cells = collectAllInternalCells(mappedPixelData);
          }
          manualStatus = 'completed';
        } else if (status === 'in_progress') {
          manualStatus = 'in_progress';
        } else {
          manualStatus = 'paused';
        }

        set((state) => ({
          byPattern: {
            ...state.byPattern,
            [patternId]: {
              completedCells: cells,
              completedColors,
              manualStatus,
            },
          },
        }));
      },

      hydrateFromRemote: (patternId, payload) => {
        const entry = get().byPattern[patternId] ?? { completedCells: [] };
        set((state) => ({
          byPattern: {
            ...state.byPattern,
            [patternId]: {
              completedCells: payload.completedCells,
              completedColors: entry.completedColors,
              manualStatus: payload.manualStatus,
            },
          },
        }));
      },

      clearPattern: (patternId) =>
        set((state) => {
          const next = { ...state.byPattern };
          delete next[patternId];
          return { byPattern: next };
        }),
    }),
    {
      name: STORE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ byPattern: state.byPattern }),
      merge: (persisted, current) => {
        const p = persisted as { byPattern?: Record<string, unknown> } | undefined;
        return {
          ...current,
          byPattern: migrateByPattern(p?.byPattern ?? {}),
        };
      },
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        const migrated = migrateByPattern(state.byPattern as Record<string, unknown>);
        if (Object.keys(migrated).length === 0) {
          const legacy = readLegacyByPattern();
          if (Object.keys(legacy).length === 0) return;
          useBeadProgressStore.setState({ byPattern: legacy });
          try {
            localStorage.removeItem(LEGACY_KEY);
          } catch {
            // ignore
          }
          return;
        }
        useBeadProgressStore.setState({ byPattern: migrated });
      },
    },
  ),
);

/** @deprecated 用 getCompletedColors / deriveCompletedColors */
export function getCompleted(patternId: string): string[] {
  return useBeadProgressStore.getState().getCompletedColors(patternId);
}
