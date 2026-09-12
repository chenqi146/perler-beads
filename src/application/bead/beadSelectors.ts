'use client';

import { useShallow } from 'zustand/react/shallow';
import { useBeadProgressStore } from './beadProgressStore';
import { useEditorUiStore } from '../editor/editorUiStore';
import { usePatternStore } from '../pattern/patternStore';

const EMPTY_COMPLETED: string[] = [];

/** 拼豆页视口 + 高亮操作（含 reset / toggle） */
export function useBeadUi() {
  return useEditorUiStore(
    useShallow((s) => ({
      previewZoom: s.previewZoom,
      canvasOffset: s.canvasOffset,
      panBy: s.panBy,
      highlightHex: s.highlightColorKey,
      toggleHighlightColorKey: s.toggleHighlightColorKey,
      setHighlightColorKey: s.setHighlightColorKey,
      resetViewport: s.resetViewport,
    })),
  );
}

/** 某图纸的完成色列表（缺失时返回稳定空数组） */
export function useBeadCompletedColors(patternId: string) {
  return useBeadProgressStore((s) => s.byPattern[patternId] ?? EMPTY_COMPLETED);
}

export function useBeadProgressActions() {
  return useBeadProgressStore(useShallow((s) => ({ setCompleted: s.setCompleted })));
}

export function usePatternLoadActions() {
  return usePatternStore(
    useShallow((s) => ({
      loadPattern: s.loadPattern,
      setCurrentPattern: s.setCurrentPattern,
    })),
  );
}
