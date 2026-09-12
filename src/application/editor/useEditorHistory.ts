'use client';

import { useCallback, type MutableRefObject } from 'react';
import { useEditorStore, type EditSnapshot } from '../editor/editorStore';

type UseEditorHistoryOptions = {
  suppressPixelateUntilRef: MutableRefObject<number>;
  showToast: (msg: string) => void;
};

/** 编辑历史：快照 / 多步撤回 / 去背景撤回 */
export function useEditorHistory({ suppressPixelateUntilRef, showToast }: UseEditorHistoryOptions) {
  const mappedPixelData = useEditorStore((s) => s.mappedPixelData);
  const colorCounts = useEditorStore((s) => s.colorCounts);
  const totalBeadCount = useEditorStore((s) => s.totalBeadCount);
  const gridDimensions = useEditorStore((s) => s.gridDimensions);
  const granularity = useEditorStore((s) => s.granularity);
  const gridHeight = useEditorStore((s) => s.gridHeight);
  const editHistory = useEditorStore((s) => s.editHistory);
  const bgRemovalSnapshot = useEditorStore((s) => s.bgRemovalSnapshot);

  const setMappedPixelData = useEditorStore((s) => s.setMappedPixelData);
  const setColorCounts = useEditorStore((s) => s.setColorCounts);
  const setTotalBeadCount = useEditorStore((s) => s.setTotalBeadCount);
  const setGridDimensions = useEditorStore((s) => s.setGridDimensions);
  const setGranularity = useEditorStore((s) => s.setGranularity);
  const setGridHeight = useEditorStore((s) => s.setGridHeight);
  const setGranularityInput = useEditorStore((s) => s.setGranularityInput);
  const setGridHeightInput = useEditorStore((s) => s.setGridHeightInput);
  const setEditHistory = useEditorStore((s) => s.setEditHistory);
  const setBgRemovalSnapshot = useEditorStore((s) => s.setBgRemovalSnapshot);
  const setSelectedCells = useEditorStore((s) => s.setSelectedCells);
  const setShowSelectionRecolor = useEditorStore((s) => s.setShowSelectionRecolor);

  const saveEditSnapshot = useCallback(() => {
    if (!mappedPixelData || !colorCounts) return;
    const snapshot: EditSnapshot = {
      mappedPixelData: mappedPixelData.map((row) => row.map((cell) => ({ ...cell }))),
      colorCounts: { ...colorCounts },
      totalBeadCount,
      gridDimensions: gridDimensions ? { ...gridDimensions } : null,
      granularity,
      gridHeight,
    };
    setEditHistory((prev) => [...prev.slice(-49), snapshot]);
  }, [
    mappedPixelData,
    colorCounts,
    totalBeadCount,
    gridDimensions,
    granularity,
    gridHeight,
    setEditHistory,
  ]);

  const handleUndoEdit = useCallback(() => {
    if (editHistory.length === 0) return;
    const snapshot = editHistory[editHistory.length - 1];
    suppressPixelateUntilRef.current = Date.now() + 400;
    setMappedPixelData(snapshot.mappedPixelData);
    setColorCounts(snapshot.colorCounts);
    setTotalBeadCount(snapshot.totalBeadCount);
    if (snapshot.gridDimensions) {
      setGridDimensions(snapshot.gridDimensions);
      setGranularity(snapshot.granularity);
      setGridHeight(snapshot.gridHeight);
      setGranularityInput(String(snapshot.granularity));
      setGridHeightInput(String(snapshot.gridHeight));
    }
    setEditHistory((prev) => prev.slice(0, -1));
    setSelectedCells(new Set());
    setShowSelectionRecolor(false);
    showToast('已撤回上一步');
  }, [
    editHistory,
    showToast,
    suppressPixelateUntilRef,
    setMappedPixelData,
    setColorCounts,
    setTotalBeadCount,
    setGridDimensions,
    setGranularity,
    setGridHeight,
    setGranularityInput,
    setGridHeightInput,
    setEditHistory,
    setSelectedCells,
    setShowSelectionRecolor,
  ]);

  const handleUndoBgRemoval = useCallback(() => {
    if (!bgRemovalSnapshot) return;
    setMappedPixelData(bgRemovalSnapshot.mappedPixelData);
    setColorCounts(bgRemovalSnapshot.colorCounts);
    setTotalBeadCount(bgRemovalSnapshot.totalBeadCount);
    setBgRemovalSnapshot(null);
    showToast('已撤回背景去除');
  }, [
    bgRemovalSnapshot,
    showToast,
    setMappedPixelData,
    setColorCounts,
    setTotalBeadCount,
    setBgRemovalSnapshot,
  ]);

  const clearEditHistory = useCallback(() => {
    setEditHistory([]);
  }, [setEditHistory]);

  return {
    editHistory,
    bgRemovalSnapshot,
    saveEditSnapshot,
    handleUndoEdit,
    handleUndoBgRemoval,
    clearEditHistory,
    setBgRemovalSnapshot,
  };
}
