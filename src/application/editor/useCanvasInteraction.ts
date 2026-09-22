'use client';

import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import {
  TRANSPARENT_KEY,
  transparentColorData,
  recalculateColorStats,
} from '../../domain/pixelation';
import { useEditorStore, type EditSnapshot } from './editorStore';
import { useEditorUiStore } from './editorUiStore';

export type CanvasTooltipData = {
  x: number;
  y: number;
  key: string;
  color: string;
};

export type UseCanvasInteractionOptions = {
  setBgRemovalSnapshot: (snapshot: EditSnapshot | null) => void;
  clearEditHistory: () => void;
  pixelatedCanvasRef: MutableRefObject<HTMLCanvasElement | null>;
  mainRef: MutableRefObject<HTMLElement | null>;
  tooltipData: CanvasTooltipData | null;
  setTooltipData: Dispatch<SetStateAction<CanvasTooltipData | null>>;
};

/** 画布点击/悬停、一键去背景、高亮完成 */
export function useCanvasInteraction({
  setBgRemovalSnapshot,
  clearEditHistory,
  pixelatedCanvasRef,
  mainRef,
  tooltipData,
  setTooltipData,
}: UseCanvasInteractionOptions) {

  const mappedPixelData = useEditorStore((s) => s.mappedPixelData);
  const setMappedPixelData = useEditorStore((s) => s.setMappedPixelData);
  const gridDimensions = useEditorStore((s) => s.gridDimensions);
  const colorCounts = useEditorStore((s) => s.colorCounts);
  const setColorCounts = useEditorStore((s) => s.setColorCounts);
  const totalBeadCount = useEditorStore((s) => s.totalBeadCount);
  const setTotalBeadCount = useEditorStore((s) => s.setTotalBeadCount);
  const granularity = useEditorStore((s) => s.granularity);
  const gridHeight = useEditorStore((s) => s.gridHeight);

  const previewZoom = useEditorUiStore((s) => s.previewZoom);
  const setHighlightColorKey = useEditorUiStore((s) => s.setHighlightColorKey);

  const handleAutoRemoveBackground = useCallback(() => {
    if (!mappedPixelData || !gridDimensions) {
      alert('请先生成图纸后再使用一键去背景。');
      return;
    }

    setBgRemovalSnapshot({
      mappedPixelData: mappedPixelData.map((row) => row.map((cell) => ({ ...cell }))),
      colorCounts: colorCounts ? { ...colorCounts } : {},
      totalBeadCount,
      gridDimensions: { ...gridDimensions },
      granularity,
      gridHeight,
    });
    clearEditHistory();

    const { N, M } = gridDimensions;
    const borderCounts = new Map<string, number>();

    const countBorderCell = (row: number, col: number) => {
      const cell = mappedPixelData[row]?.[col];
      if (!cell || cell.isExternal || cell.key === TRANSPARENT_KEY) return;
      borderCounts.set(cell.key, (borderCounts.get(cell.key) || 0) + 1);
    };

    for (let col = 0; col < N; col++) {
      countBorderCell(0, col);
      if (M > 1) countBorderCell(M - 1, col);
    }
    for (let row = 1; row < M - 1; row++) {
      countBorderCell(row, 0);
      if (N > 1) countBorderCell(row, N - 1);
    }

    if (borderCounts.size === 0) {
      alert('边缘没有可识别的背景颜色。');
      return;
    }

    let targetKey = '';
    let maxCount = -1;
    borderCounts.forEach((count, key) => {
      if (count > maxCount) {
        maxCount = count;
        targetKey = key;
      }
    });

    const newPixelData = mappedPixelData.map((row) => row.map((cell) => ({ ...cell })));
    const visited = Array(M)
      .fill(null)
      .map(() => Array(N).fill(false));
    const stack: { row: number; col: number }[] = [];

    const pushIfTarget = (row: number, col: number) => {
      if (row < 0 || row >= M || col < 0 || col >= N || visited[row][col]) {
        return;
      }
      const cell = newPixelData[row][col];
      if (!cell || cell.isExternal || cell.key !== targetKey) return;
      visited[row][col] = true;
      stack.push({ row, col });
    };

    for (let col = 0; col < N; col++) {
      pushIfTarget(0, col);
      if (M > 1) pushIfTarget(M - 1, col);
    }
    for (let row = 1; row < M - 1; row++) {
      pushIfTarget(row, 0);
      if (N > 1) pushIfTarget(row, N - 1);
    }

    if (stack.length === 0) {
      alert('未找到可去除的背景区域。');
      return;
    }

    while (stack.length > 0) {
      const { row, col } = stack.pop()!;
      newPixelData[row][col] = { ...transparentColorData };
      pushIfTarget(row - 1, col);
      pushIfTarget(row + 1, col);
      pushIfTarget(row, col - 1);
      pushIfTarget(row, col + 1);
    }

    setMappedPixelData(newPixelData);

    const { colorCounts: newColorCounts, totalCount: newTotalCount } =
      recalculateColorStats(newPixelData);

    setColorCounts(newColorCounts);
    setTotalBeadCount(newTotalCount);
    useEditorStore.getState().markGridManuallyEdited();
  }, [
    mappedPixelData,
    gridDimensions,
    colorCounts,
    totalBeadCount,
    granularity,
    gridHeight,
    setBgRemovalSnapshot,
    clearEditHistory,
    setMappedPixelData,
    setColorCounts,
    setTotalBeadCount,
  ]);

  const handleHighlightComplete = useCallback(() => {
    setHighlightColorKey(null);
  }, [setHighlightColorKey]);

  const handleCanvasInteraction = useCallback(
    (
      clientX: number,
      clientY: number,
      pageX: number,
      pageY: number,
      isClick: boolean = false,
      isTouchEnd: boolean = false,
    ) => {
      void pageX;
      void pageY;

      if (isTouchEnd) {
        setTooltipData(null);
        return;
      }

      const canvas = pixelatedCanvasRef.current;
      if (!canvas || !mappedPixelData || !gridDimensions) {
        setTooltipData(null);
        return;
      }

      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const canvasX = (clientX - rect.left) * scaleX;
      const canvasY = (clientY - rect.top) * scaleY;

      const { N, M } = gridDimensions;
      const cellSize = Math.max(4, Math.round(16 * previewZoom));
      const axisSize = Math.max(18, Math.min(36, Math.round(cellSize * 1.4)));
      const i = Math.floor((canvasX - axisSize) / cellSize);
      const j = Math.floor((canvasY - axisSize) / cellSize);

      if (i >= 0 && i < N && j >= 0 && j < M) {
        const cellData = mappedPixelData[j][i];

        if (cellData && !cellData.isExternal && cellData.key) {
          if (isClick && tooltipData) {
            const tooltipRect = canvas.getBoundingClientRect();
            const prevX = tooltipData.x;
            const prevY = tooltipData.y;
            const prevCanvasX = (prevX - tooltipRect.left) * scaleX;
            const prevCanvasY = (prevY - tooltipRect.top) * scaleY;
            const prevCellI = Math.floor((prevCanvasX - axisSize) / cellSize);
            const prevCellJ = Math.floor((prevCanvasY - axisSize) / cellSize);

            if (i === prevCellI && j === prevCellJ) {
              setTooltipData(null);
              return;
            }
          }

          const mainElement = mainRef.current;
          if (mainElement) {
            const mainRect = mainElement.getBoundingClientRect();
            setTooltipData({
              x: clientX - mainRect.left,
              y: clientY - mainRect.top,
              key: cellData.key,
              color: cellData.color,
            });
          } else {
            setTooltipData({
              x: clientX,
              y: clientY,
              key: cellData.key,
              color: cellData.color,
            });
          }
        } else {
          setTooltipData(null);
        }
      } else {
        setTooltipData(null);
      }
    },
    [
      pixelatedCanvasRef,
      mappedPixelData,
      gridDimensions,
      previewZoom,
      tooltipData,
      mainRef,
      setTooltipData,
    ],
  );

  return {
    handleCanvasInteraction,
    handleAutoRemoveBackground,
    handleHighlightComplete,
  };
}
