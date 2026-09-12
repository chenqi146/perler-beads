import { create } from 'zustand';
import {
  MappedPixel,
  PaletteColor,
  PixelationMode,
} from '../../domain/pixelation';
import type { ColorSystem } from '../../domain/palette';
import type { CanvasToolMode, CropRect } from '../../components/PixelatedPreviewCanvas';
import type { PaletteSelections } from '../../domain/palette';
import type { PatternData } from '../../domain/pattern';

export type EditSnapshot = {
  mappedPixelData: MappedPixel[][];
  colorCounts: { [key: string]: { count: number; color: string } };
  totalBeadCount: number;
  gridDimensions: { N: number; M: number } | null;
  granularity: number;
  gridHeight: number;
};

type ColorCounts = { [key: string]: { count: number; color: string } } | null;

type EditorState = {
  mappedPixelData: MappedPixel[][] | null;
  gridDimensions: { N: number; M: number } | null;
  colorCounts: ColorCounts;
  totalBeadCount: number;
  originalImageSrc: string | null;
  preAiImageSrc: string | null;

  granularity: number;
  granularityInput: string;
  gridHeight: number;
  gridHeightInput: string;
  keepAspectRatio: boolean;
  imageAspectRatio: number;
  similarityThreshold: number;
  similarityThresholdInput: string;
  maxColorCount: number;
  autoRemoveWhiteBg: boolean;
  pixelationMode: PixelationMode;
  remapTrigger: number;

  selectedColorSystem: ColorSystem;
  activeBeadPalette: PaletteColor[];
  customPaletteSelections: PaletteSelections;

  selectedColor: MappedPixel | null;
  canvasToolMode: CanvasToolMode;
  selectedCells: Set<string>;
  cropRect: CropRect | null;
  showSelectionRecolor: boolean;

  editHistory: EditSnapshot[];
  bgRemovalSnapshot: EditSnapshot | null;

  setMappedPixelData: (data: MappedPixel[][] | null) => void;
  setGridDimensions: (dims: { N: number; M: number } | null) => void;
  setColorCounts: (counts: ColorCounts) => void;
  setTotalBeadCount: (n: number) => void;
  setOriginalImageSrc: (src: string | null) => void;
  setPreAiImageSrc: (src: string | null) => void;

  setGranularity: (n: number) => void;
  setGranularityInput: (s: string) => void;
  setGridHeight: (n: number) => void;
  setGridHeightInput: (s: string) => void;
  setKeepAspectRatio: (v: boolean) => void;
  setImageAspectRatio: (n: number) => void;
  setSimilarityThreshold: (n: number) => void;
  setSimilarityThresholdInput: (s: string) => void;
  setMaxColorCount: (n: number) => void;
  setAutoRemoveWhiteBg: (v: boolean) => void;
  setPixelationMode: (m: PixelationMode) => void;
  bumpRemapTrigger: () => void;
  setRemapTrigger: (n: number | ((prev: number) => number)) => void;

  setSelectedColorSystem: (s: ColorSystem) => void;
  setActiveBeadPalette: (p: PaletteColor[]) => void;
  setCustomPaletteSelections: (
    sel: PaletteSelections | ((prev: PaletteSelections) => PaletteSelections),
  ) => void;

  setSelectedColor: (c: MappedPixel | null) => void;
  setCanvasToolMode: (m: CanvasToolMode) => void;
  setSelectedCells: (cells: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  setCropRect: (r: CropRect | null | ((prev: CropRect | null) => CropRect | null)) => void;
  setShowSelectionRecolor: (v: boolean) => void;

  setEditHistory: (h: EditSnapshot[] | ((prev: EditSnapshot[]) => EditSnapshot[])) => void;
  setBgRemovalSnapshot: (s: EditSnapshot | null) => void;

  hydrateFromPatternData: (data: PatternData) => void;
  getPatternDataSnapshot: () => PatternData;
  resetDocument: () => void;
};

export const useEditorStore = create<EditorState>((set, get) => ({
  mappedPixelData: null,
  gridDimensions: null,
  colorCounts: null,
  totalBeadCount: 0,
  originalImageSrc: null,
  preAiImageSrc: null,

  granularity: 50,
  granularityInput: '50',
  gridHeight: 50,
  gridHeightInput: '50',
  keepAspectRatio: true,
  imageAspectRatio: 1,
  similarityThreshold: 0,
  similarityThresholdInput: '0',
  maxColorCount: 0,
  autoRemoveWhiteBg: false,
  pixelationMode: PixelationMode.Dominant,
  remapTrigger: 0,

  selectedColorSystem: 'MARD',
  activeBeadPalette: [],
  customPaletteSelections: {},

  selectedColor: null,
  canvasToolMode: 'select',
  selectedCells: new Set(),
  cropRect: null,
  showSelectionRecolor: false,

  editHistory: [],
  bgRemovalSnapshot: null,

  setMappedPixelData: (data) => set({ mappedPixelData: data }),
  setGridDimensions: (dims) => set({ gridDimensions: dims }),
  setColorCounts: (counts) => set({ colorCounts: counts }),
  setTotalBeadCount: (n) => set({ totalBeadCount: n }),
  setOriginalImageSrc: (src) => set({ originalImageSrc: src }),
  setPreAiImageSrc: (src) => set({ preAiImageSrc: src }),

  setGranularity: (n) => set({ granularity: n }),
  setGranularityInput: (s) => set({ granularityInput: s }),
  setGridHeight: (n) => set({ gridHeight: n }),
  setGridHeightInput: (s) => set({ gridHeightInput: s }),
  setKeepAspectRatio: (v) => set({ keepAspectRatio: v }),
  setImageAspectRatio: (n) => set({ imageAspectRatio: n }),
  setSimilarityThreshold: (n) => set({ similarityThreshold: n }),
  setSimilarityThresholdInput: (s) => set({ similarityThresholdInput: s }),
  setMaxColorCount: (n) => set({ maxColorCount: n }),
  setAutoRemoveWhiteBg: (v) => set({ autoRemoveWhiteBg: v }),
  setPixelationMode: (m) => set({ pixelationMode: m }),
  bumpRemapTrigger: () => set((s) => ({ remapTrigger: s.remapTrigger + 1 })),
  setRemapTrigger: (n) =>
    set((s) => ({
      remapTrigger: typeof n === 'function' ? n(s.remapTrigger) : n,
    })),

  setSelectedColorSystem: (sys) => set({ selectedColorSystem: sys }),
  setActiveBeadPalette: (p) => set({ activeBeadPalette: p }),
  setCustomPaletteSelections: (sel) =>
    set((s) => ({
      customPaletteSelections: typeof sel === 'function' ? sel(s.customPaletteSelections) : sel,
    })),

  setSelectedColor: (c) => set({ selectedColor: c }),
  setCanvasToolMode: (m) => set({ canvasToolMode: m }),
  setSelectedCells: (cells) =>
    set((s) => ({
      selectedCells: typeof cells === 'function' ? cells(s.selectedCells) : cells,
    })),
  setCropRect: (r) =>
    set((s) => ({
      cropRect: typeof r === 'function' ? r(s.cropRect) : r,
    })),
  setShowSelectionRecolor: (v) => set({ showSelectionRecolor: v }),

  setEditHistory: (h) =>
    set((s) => ({
      editHistory: typeof h === 'function' ? h(s.editHistory) : h,
    })),
  setBgRemovalSnapshot: (snap) => set({ bgRemovalSnapshot: snap }),

  hydrateFromPatternData: (data) => {
    set({
      mappedPixelData: data.mappedPixelData,
      gridDimensions: data.gridDimensions,
      colorCounts: data.colorCounts,
      totalBeadCount: data.totalBeadCount,
      originalImageSrc: data.originalImageSrc,
      selectedColorSystem: (data.selectedColorSystem as ColorSystem) || 'MARD',
      granularity: data.gridDimensions.N || 50,
      granularityInput: String(data.gridDimensions.N || 50),
      gridHeight: data.gridDimensions.M || 50,
      gridHeightInput: String(data.gridDimensions.M || 50),
      selectedCells: new Set(),
      cropRect: null,
      editHistory: [],
      bgRemovalSnapshot: null,
    });
  },

  getPatternDataSnapshot: () => {
    const s = get();
    return {
      mappedPixelData: s.mappedPixelData ?? [],
      gridDimensions: s.gridDimensions ?? { N: 0, M: 0 },
      colorCounts: s.colorCounts,
      totalBeadCount: s.totalBeadCount,
      originalImageSrc: s.originalImageSrc,
      selectedColorSystem: s.selectedColorSystem,
    };
  },

  resetDocument: () =>
    set({
      mappedPixelData: null,
      gridDimensions: null,
      colorCounts: null,
      totalBeadCount: 0,
      originalImageSrc: null,
      preAiImageSrc: null,
      selectedCells: new Set(),
      cropRect: null,
      editHistory: [],
      bgRemovalSnapshot: null,
      selectedColor: null,
    }),
}));
