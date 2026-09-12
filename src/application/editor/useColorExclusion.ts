'use client';

import { useCallback, type MutableRefObject } from 'react';
import { findClosestPaletteColor } from '../../domain/pixelation';
import { fullBeadPalette } from '../../domain/palette/fullBeadPalette';
import { useEditorStore, type EditSnapshot } from './editorStore';

type UseColorExclusionOptions = {
  clearEditHistory: () => void;
  setBgRemovalSnapshot: (snapshot: EditSnapshot | null) => void;
  /** 与原先一致：排除后若 canvas/尺寸就绪则再写一次 mappedPixelData */
  pixelatedCanvasRef?: MutableRefObject<HTMLCanvasElement | null>;
};

/** 颜色排除 / 重映射；重新纳入时触发完整 remap */
export function useColorExclusion({
  clearEditHistory,
  setBgRemovalSnapshot,
  pixelatedCanvasRef,
}: UseColorExclusionOptions) {
  const mappedPixelData = useEditorStore((s) => s.mappedPixelData);
  const setMappedPixelData = useEditorStore((s) => s.setMappedPixelData);
  const gridDimensions = useEditorStore((s) => s.gridDimensions);
  const setColorCounts = useEditorStore((s) => s.setColorCounts);
  const setTotalBeadCount = useEditorStore((s) => s.setTotalBeadCount);
  const excludedColorKeys = useEditorStore((s) => s.excludedColorKeys);
  const setExcludedColorKeys = useEditorStore((s) => s.setExcludedColorKeys);
  const initialGridColorKeys = useEditorStore((s) => s.initialGridColorKeys);
  const setRemapTrigger = useEditorStore((s) => s.setRemapTrigger);
  const setIsManualColoringMode = useEditorStore((s) => s.setIsManualColoringMode);
  const setSelectedColor = useEditorStore((s) => s.setSelectedColor);

  const handleToggleExcludeColor = useCallback(
    (hexKey: string) => {
      const currentExcluded = excludedColorKeys;
      const isExcluding = !currentExcluded.has(hexKey);

      if (isExcluding) {
        console.log(`---------\nAttempting to EXCLUDE color: ${hexKey}`);

        if (initialGridColorKeys.size === 0) {
          console.error('Cannot exclude color: Initial grid color keys not yet calculated.');
          alert('无法排除颜色，初始颜色数据尚未准备好，请稍候。');
          return;
        }
        console.log('Initial Grid Hex Keys:', Array.from(initialGridColorKeys));
        console.log('Currently Excluded Hex Keys (before this op):', Array.from(currentExcluded));

        const nextExcludedKeys = new Set(currentExcluded);
        nextExcludedKeys.add(hexKey);

        const potentialRemapHexKeys = new Set(initialGridColorKeys);
        console.log('Step 1: Potential Hex Keys (from initial):', Array.from(potentialRemapHexKeys));

        potentialRemapHexKeys.delete(hexKey);
        console.log(
          `Step 2: Potential Hex Keys (after removing ${hexKey}):`,
          Array.from(potentialRemapHexKeys),
        );

        currentExcluded.forEach((excludedHexKey) => {
          potentialRemapHexKeys.delete(excludedHexKey);
        });
        console.log(
          'Step 3: Potential Hex Keys (after removing other current exclusions):',
          Array.from(potentialRemapHexKeys),
        );

        const remapTargetPalette = fullBeadPalette.filter((color) =>
          potentialRemapHexKeys.has(color.hex.toUpperCase()),
        );
        const remapTargetHexKeys = remapTargetPalette.map((p) => p.hex.toUpperCase());
        console.log('Step 4: Remap Target Palette Hex Keys:', remapTargetHexKeys);

        if (remapTargetPalette.length === 0) {
          console.warn(
            `Cannot exclude color '${hexKey}'. No other valid colors from the initial grid remain after considering all current exclusions.`,
          );
          alert(
            `无法排除颜色 ${hexKey}，因为图中最初存在的其他可用颜色也已被排除。请先恢复部分其他颜色。`,
          );
          console.log('---------');
          return;
        }
        console.log(
          `Remapping target palette (based on initial grid colors minus all exclusions) contains ${remapTargetPalette.length} colors.`,
        );

        const excludedColorData = fullBeadPalette.find((p) => p.hex.toUpperCase() === hexKey);
        if (!excludedColorData || !mappedPixelData || !gridDimensions) {
          console.error('Cannot exclude color: Missing data for remapping.');
          alert('无法排除颜色，缺少必要数据。');
          console.log('---------');
          return;
        }

        console.log(`Remapping cells currently using excluded color: ${hexKey}`);
        const newMappedData = mappedPixelData.map((row) => row.map((cell) => ({ ...cell })));
        let remappedCount = 0;
        const { N, M } = gridDimensions;
        let firstReplacementHex: string | null = null;

        for (let j = 0; j < M; j++) {
          for (let i = 0; i < N; i++) {
            const cell = newMappedData[j]?.[i];
            if (cell && !cell.isExternal && cell.color.toUpperCase() === hexKey) {
              const replacementColor = findClosestPaletteColor(
                excludedColorData.rgb,
                remapTargetPalette,
              );
              if (!firstReplacementHex) firstReplacementHex = replacementColor.hex;
              newMappedData[j][i] = {
                ...cell,
                key: replacementColor.key,
                color: replacementColor.hex,
              };
              remappedCount++;
            }
          }
        }
        console.log(
          `Remapped ${remappedCount} cells. First replacement hex found was: ${firstReplacementHex || 'N/A'}`,
        );

        setExcludedColorKeys(nextExcludedKeys);
        setMappedPixelData(newMappedData);

        const newCounts: { [hexKey: string]: { count: number; color: string } } = {};
        let newTotalCount = 0;
        newMappedData.flat().forEach((cell) => {
          if (cell && cell.color && !cell.isExternal) {
            const cellHex = cell.color.toUpperCase();
            if (!newCounts[cellHex]) {
              newCounts[cellHex] = { count: 0, color: cellHex };
            }
            newCounts[cellHex].count++;
            newTotalCount++;
          }
        });
        setColorCounts(newCounts);
        setTotalBeadCount(newTotalCount);
        console.log('State updated after exclusion and local remap based on initial grid colors.');
        console.log('---------');

        if (pixelatedCanvasRef?.current && gridDimensions) {
          setMappedPixelData(newMappedData);
        } else {
          console.error(
            'Canvas ref or grid dimensions missing, skipping draw call in handleToggleExcludeColor.',
          );
        }
      } else {
        console.log(`---------\nAttempting to RE-INCLUDE color: ${hexKey}`);
        console.log(`Re-including color: ${hexKey}. Triggering full remap.`);
        const nextExcludedKeys = new Set(currentExcluded);
        nextExcludedKeys.delete(hexKey);
        setExcludedColorKeys(nextExcludedKeys);
        setRemapTrigger((prev) => prev + 1);
        console.log('---------');
      }

      setIsManualColoringMode(false);
      setSelectedColor(null);
      clearEditHistory();
      setBgRemovalSnapshot(null);
    },
    [
      excludedColorKeys,
      initialGridColorKeys,
      mappedPixelData,
      gridDimensions,
      setExcludedColorKeys,
      setMappedPixelData,
      setColorCounts,
      setTotalBeadCount,
      setRemapTrigger,
      setIsManualColoringMode,
      setSelectedColor,
      clearEditHistory,
      setBgRemovalSnapshot,
      pixelatedCanvasRef,
    ],
  );

  return { handleToggleExcludeColor };
}
