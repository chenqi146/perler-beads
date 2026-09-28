import { create } from 'zustand';

export type UploadMode = 'generate' | 'recognize';

/**
 * 编辑 / 拼豆共用的画布 UI 状态
 * Phase 3：从 page.tsx 迁入 previewZoom、canvasOffset、highlight 等
 */
type EditorUiState = {
  previewZoom: number;
  canvasOffset: { x: number; y: number };
  highlightColorKey: string | null;
  uploadMode: UploadMode;
  isRecognizingPattern: boolean;
  setPreviewZoom: (zoom: number) => void;
  setCanvasOffset: (offset: { x: number; y: number }) => void;
  panBy: (dx: number, dy: number) => void;
  setHighlightColorKey: (hex: string | null) => void;
  toggleHighlightColorKey: (hex: string) => void;
  setUploadMode: (mode: UploadMode) => void;
  setRecognizingPattern: (busy: boolean) => void;
  resetViewport: () => void;
};

export const useEditorUiStore = create<EditorUiState>((set, get) => ({
  previewZoom: 1,
  canvasOffset: { x: 16, y: 16 },
  highlightColorKey: null,
  uploadMode: 'generate',
  isRecognizingPattern: false,

  setPreviewZoom: (zoom) => set({ previewZoom: zoom }),
  setCanvasOffset: (offset) => set({ canvasOffset: offset }),
  panBy: (dx, dy) => {
    const { canvasOffset } = get();
    set({ canvasOffset: { x: canvasOffset.x + dx, y: canvasOffset.y + dy } });
  },
  setHighlightColorKey: (hex) => set({ highlightColorKey: hex }),
  toggleHighlightColorKey: (hex) => {
    const key = hex.toUpperCase();
    const current = get().highlightColorKey?.toUpperCase() ?? null;
    set({ highlightColorKey: current === key ? null : key });
  },
  setUploadMode: (mode) => set({ uploadMode: mode }),
  setRecognizingPattern: (busy) => set({ isRecognizingPattern: busy }),
  resetViewport: () => set({ previewZoom: 1, canvasOffset: { x: 16, y: 16 }, highlightColorKey: null }),
}));
