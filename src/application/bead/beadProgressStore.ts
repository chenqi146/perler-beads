import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

type BeadProgressState = {
  /** patternId → 已完成颜色 hex（大写） */
  byPattern: Record<string, string[]>;
  getCompleted: (patternId: string) => string[];
  setCompleted: (patternId: string, hexKey: string, completed: boolean) => string[];
  clearPattern: (patternId: string) => void;
};

const LEGACY_KEY = 'perler-bead-progress-v1';
const STORE_KEY = 'perler-bead-progress-store-v1';
const EMPTY_COMPLETED: string[] = [];

function readLegacyByPattern(): Record<string, string[]> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, { completedColors?: string[] } | string[]>;
    // 已是 zustand 形态则忽略
    if (parsed && typeof parsed === 'object' && 'state' in parsed) return {};
    const byPattern: Record<string, string[]> = {};
    for (const [id, value] of Object.entries(parsed)) {
      if (Array.isArray(value)) byPattern[id] = value.map((c) => String(c).toUpperCase());
      else if (value && Array.isArray(value.completedColors)) {
        byPattern[id] = value.completedColors.map((c) => String(c).toUpperCase());
      }
    }
    return byPattern;
  } catch {
    return {};
  }
}

export const useBeadProgressStore = create<BeadProgressState>()(
  persist(
    (set, get) => ({
      byPattern: {},

      getCompleted: (patternId) => get().byPattern[patternId] ?? EMPTY_COMPLETED,

      setCompleted: (patternId, hexKey, completed) => {
        const normalized = hexKey.toUpperCase();
        const current = new Set((get().byPattern[patternId] ?? []).map((c) => c.toUpperCase()));
        if (completed) current.add(normalized);
        else current.delete(normalized);
        const completedColors = Array.from(current);
        set((state) => ({
          byPattern: {
            ...state.byPattern,
            [patternId]: completedColors,
          },
        }));
        return completedColors;
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
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        if (Object.keys(state.byPattern).length > 0) return;
        const legacy = readLegacyByPattern();
        if (Object.keys(legacy).length === 0) return;
        useBeadProgressStore.setState({ byPattern: legacy });
        try {
          localStorage.removeItem(LEGACY_KEY);
        } catch {
          // ignore
        }
      },
    },
  ),
);
