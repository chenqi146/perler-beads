'use client';

import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import {
  deriveCompletedColors,
  useBeadProgressStore,
} from './beadProgressStore';
import { useEditorUiStore } from '../editor/editorUiStore';
import { usePatternStore } from '../pattern/patternStore';
import type { MappedPixel } from '../../domain/pixelation';

const EMPTY_CELLS: string[] = [];

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

/** 已完成格子 keys */
export function useBeadCompletedCells(patternId: string) {
  return useBeadProgressStore((s) => s.byPattern[patternId]?.completedCells ?? EMPTY_CELLS);
}

/**
 * 完成色列表（由格子派生；无像素数据时回退 legacy）
 * 传入 mapped + colorHexes 时结果准确
 */
export function useBeadCompletedColors(
  patternId: string,
  mappedPixelData?: MappedPixel[][] | null,
  colorHexes?: string[],
) {
  const cells = useBeadCompletedCells(patternId);
  const legacyColors = useBeadProgressStore(
    (s) => s.byPattern[patternId]?.completedColors,
  );
  return useMemo(
    () =>
      deriveCompletedColors(
        mappedPixelData ?? null,
        colorHexes ?? [],
        cells,
        legacyColors,
      ),
    [mappedPixelData, colorHexes, cells, legacyColors],
  );
}

export function useBeadProgressActions() {
  return useBeadProgressStore(
    useShallow((s) => ({
      toggleCell: s.toggleCell,
      setColorCompleted: s.setColorCompleted,
      setCells: s.setCells,
    })),
  );
}

export function usePatternLoadActions() {
  return usePatternStore(
    useShallow((s) => ({
      loadPattern: s.loadPattern,
      setCurrentPattern: s.setCurrentPattern,
    })),
  );
}
