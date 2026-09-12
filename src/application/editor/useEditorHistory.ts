'use client';

import { useCallback, type MutableRefObject } from 'react';
import { useEditorStore, type EditSnapshot } from '../editor/editorStore';

type UseEditorHistoryOptions = {
  suppressPixelateUntilRef: MutableRefObject<number>;
  showToast: (msg: string) => void;
};

function cloneSnapshot(snapshot: EditSnapshot): EditSnapshot {
  return {
    mappedPixelData: snapshot.mappedPixelData.map((row) => row.map((cell) => ({ ...cell }))),
    colorCounts: { ...snapshot.colorCounts },
    totalBeadCount: snapshot.totalBeadCount,
    gridDimensions: snapshot.gridDimensions ? { ...snapshot.gridDimensions } : null,
    granularity: snapshot.granularity,
    gridHeight: snapshot.gridHeight,
  };
}

/** 编辑历史：快照 / 多步撤回 / 重做 / 去背景撤回 */
export function useEditorHistory({ suppressPixelateUntilRef, showToast }: UseEditorHistoryOptions) {
  const mappedPixelData = useEditorStore((s) => s.mappedPixelData);
  const colorCounts = useEditorStore((s) => s.colorCounts);
  const totalBeadCount = useEditorStore((s) => s.totalBeadCount);
  const gridDimensions = useEditorStore((s) => s.gridDimensions);
  const granularity = useEditorStore((s) => s.granularity);
  const gridHeight = useEditorStore((s) => s.gridHeight);
  const editHistory = useEditorStore((s) => s.editHistory);
  const editRedo = useEditorStore((s) => s.editRedo);
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
  const setEditRedo = useEditorStore((s) => s.setEditRedo);
  const setBgRemovalSnapshot = useEditorStore((s) => s.setBgRemovalSnapshot);
  const setSelectedCells = useEditorStore((s) => s.setSelectedCells);
  const setShowSelectionRecolor = useEditorStore((s) => s.setShowSelectionRecolor);

  const captureCurrent = useCallback((): EditSnapshot | null => {
    if (!mappedPixelData || !colorCounts) return null;
    return {
      mappedPixelData: mappedPixelData.map((row) => row.map((cell) => ({ ...cell }))),
      colorCounts: { ...colorCounts },
      totalBeadCount,
      gridDimensions: gridDimensions ? { ...gridDimensions } : null,
      granularity,
      gridHeight,
    };
  }, [
    mappedPixelData,
    colorCounts,
    totalBeadCount,
    gridDimensions,
    granularity,
    gridHeight,
  ]);

  const applySnapshot = useCallback(
    (snapshot: EditSnapshot) => {
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
      setSelectedCells(new Set());
      setShowSelectionRecolor(false);
    },
    [
      suppressPixelateUntilRef,
      setMappedPixelData,
      setColorCounts,
      setTotalBeadCount,
      setGridDimensions,
      setGranularity,
      setGridHeight,
      setGranularityInput,
      setGridHeightInput,
      setSelectedCells,
      setShowSelectionRecolor,
    ],
  );

  const saveEditSnapshot = useCallback(() => {
    const snapshot = captureCurrent();
    if (!snapshot) return;
    setEditHistory((prev) => [...prev.slice(-49), snapshot]);
    setEditRedo([]);
  }, [captureCurrent, setEditHistory, setEditRedo]);

  const handleUndoEdit = useCallback(() => {
    if (editHistory.length === 0) return;
    const current = captureCurrent();
    const snapshot = editHistory[editHistory.length - 1];
    if (current) {
      setEditRedo((prev) => [...prev.slice(-49), cloneSnapshot(current)]);
    }
    applySnapshot(snapshot);
    setEditHistory((prev) => prev.slice(0, -1));
    showToast('已撤回上一步');
  }, [
    editHistory,
    captureCurrent,
    applySnapshot,
    setEditHistory,
    setEditRedo,
    showToast,
  ]);

  const handleRedoEdit = useCallback(() => {
    if (editRedo.length === 0) return;
    const current = captureCurrent();
    const snapshot = editRedo[editRedo.length - 1];
    if (current) {
      setEditHistory((prev) => [...prev.slice(-49), cloneSnapshot(current)]);
    }
    applySnapshot(snapshot);
    setEditRedo((prev) => prev.slice(0, -1));
    showToast('已重做');
  }, [
    editRedo,
    captureCurrent,
    applySnapshot,
    setEditHistory,
    setEditRedo,
    showToast,
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
    setEditRedo([]);
  }, [setEditHistory, setEditRedo]);

  return {
    editHistory,
    editRedo,
    bgRemovalSnapshot,
    saveEditSnapshot,
    handleUndoEdit,
    handleRedoEdit,
    handleUndoBgRemoval,
    clearEditHistory,
    setBgRemovalSnapshot,
  };
}
