import { create } from 'zustand';
import type { Pattern, PatternData, PatternInput, Visibility } from '../../domain/pattern';
import {
  localPatternRepository,
  putOriginalImage,
  getOriginalImage,
  deleteOriginalImage,
} from '../../infrastructure/storage';
import { pullPatternsFromCloud, pushPatternToCloud } from '../../utils/patternSync';
import { useEditorStore } from '../editor/editorStore';

type PatternState = {
  patterns: Pattern[];
  publicPatterns: Pattern[];
  currentPatternId: string | null;
  currentPattern: Pattern | null;
  syncMessage: string | null;

  refreshPatterns: () => void;
  refreshPatternsFromCloud: () => Promise<void>;
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
  syncMessage: null,

  refreshPatterns: () => {
    try {
      set({ patterns: repo.listByOwner() });
    } catch {
      set({ patterns: [] });
    }
  },

  refreshPatternsFromCloud: async () => {
    const result = await pullPatternsFromCloud();
    try {
      set({
        patterns: repo.listByOwner(),
        syncMessage: result.ok ? null : result.message,
      });
    } catch {
      set({ patterns: [], syncMessage: result.ok ? null : result.message });
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
    const original = input.data.originalImageSrc;
    const runPush = () => {
      void pushPatternToCloud({
        ...saved,
        data: {
          ...saved.data,
          originalImageSrc: original,
          originalImageKey: input.data.originalImageKey ?? saved.data.originalImageKey ?? null,
        },
      }).then((result) => {
        if (!result.ok) set({ syncMessage: result.message });
        else {
          set({ syncMessage: null });
          const key = result.pattern?.data?.originalImageKey;
          if (key) {
            useEditorStore.getState().setOriginalImageKey(key);
            // 刷新列表里的 key
            set({ patterns: repo.listByOwner() });
          }
        }
      });
    };

    if (typeof original === 'string' && original.startsWith('data:')) {
      void putOriginalImage(saved.id, original).then(runPush);
    } else {
      runPush();
    }

    const { currentPatternId } = get();
    set((state) => ({
      patterns: repo.listByOwner(),
      currentPattern:
        currentPatternId === saved.id || !currentPatternId ? saved : state.currentPattern,
      currentPatternId: currentPatternId ?? saved.id,
    }));
    return saved;
  },

  deletePattern: (patternId) => {
    repo.remove(patternId);
    void deleteOriginalImage(patternId);
    set((state) => ({
      patterns: repo.listByOwner(),
      currentPattern: state.currentPatternId === patternId ? null : state.currentPattern,
      currentPatternId: state.currentPatternId === patternId ? null : state.currentPatternId,
    }));
  },

  duplicatePattern: (patternId) => {
    const copy = repo.duplicate(patternId) ?? undefined;
    if (copy) {
      set({ patterns: repo.listByOwner() });
      void getOriginalImage(patternId).then((src) => {
        if (src) void putOriginalImage(copy.id, src);
      });
      void pushPatternToCloud(copy);
    }
    return copy;
  },
}));

export type { PatternInput, PatternData, Visibility };
