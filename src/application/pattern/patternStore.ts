import { create } from 'zustand';
import type { Pattern, PatternData, PatternInput, Visibility } from '../../domain/pattern';
import { localPatternRepository } from '../../infrastructure/storage';

type PatternState = {
  patterns: Pattern[];
  publicPatterns: Pattern[];
  currentPatternId: string | null;
  currentPattern: Pattern | null;

  refreshPatterns: () => void;
  refreshPublicPatterns: () => void;
  loadPattern: (id: string) => Pattern | null;
  setCurrentPattern: (pattern: Pattern | null) => void;
  setCurrentPatternId: (id: string | null) => void;
  savePattern: (input: PatternInput, patternId?: string) => Pattern;
  deletePattern: (patternId: string) => void;
  duplicatePattern: (patternId: string) => Pattern | undefined;
};

const repo = localPatternRepository;

export const usePatternStore = create<PatternState>((set, get) => ({
  patterns: [],
  publicPatterns: [],
  currentPatternId: null,
  currentPattern: null,

  refreshPatterns: () => {
    try {
      set({ patterns: repo.listByOwner() });
    } catch {
      set({ patterns: [] });
    }
  },

  refreshPublicPatterns: () => {
    try {
      set({ publicPatterns: repo.listPublic() });
    } catch {
      set({ publicPatterns: [] });
    }
  },

  loadPattern: (id) => {
    const pattern = repo.get(id);
    set({
      currentPattern: pattern,
      currentPatternId: pattern?.id ?? null,
    });
    return pattern;
  },

  setCurrentPattern: (pattern) =>
    set({
      currentPattern: pattern,
      currentPatternId: pattern?.id ?? null,
    }),

  setCurrentPatternId: (id) => set({ currentPatternId: id }),

  savePattern: (input, patternId) => {
    const saved = repo.save(input, patternId);
    const { currentPatternId } = get();
    set((state) => ({
      patterns: repo.listByOwner(),
      currentPattern: currentPatternId === saved.id || !currentPatternId ? saved : state.currentPattern,
      currentPatternId: currentPatternId ?? saved.id,
    }));
    return saved;
  },

  deletePattern: (patternId) => {
    repo.remove(patternId);
    set((state) => ({
      patterns: repo.listByOwner(),
      currentPattern: state.currentPatternId === patternId ? null : state.currentPattern,
      currentPatternId: state.currentPatternId === patternId ? null : state.currentPatternId,
    }));
  },

  duplicatePattern: (patternId) => {
    const copy = repo.duplicate(patternId) ?? undefined;
    if (copy) set({ patterns: repo.listByOwner() });
    return copy;
  },
}));

export type { PatternInput, PatternData, Visibility };
