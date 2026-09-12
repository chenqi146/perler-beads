'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import RequireAuth from '../../../components/RequireAuth';
import { useAppNavSubtitle } from '../../../components/shell';
import { BeadPageToolbar, BeadColorList, type RegionSortMode } from '../../../components/editor';
import PixelatedPreviewCanvas, { cellKey } from '../../../components/PixelatedPreviewCanvas';
import { getColorKeyByHex, type ColorSystem } from '../../../domain/palette';
import {
  getAllConnectedRegions,
  isRegionCompleted,
  sortRegionsByDistance,
  sortRegionsByEdge,
  sortRegionsBySize,
} from '../../../domain/pixelation';
import type { Pattern } from '../../../types/platform';
import { useBeadProgressStore } from '../../../application/bead/beadProgressStore';
import {
  loadCraftSessionForPattern,
  pushCraftSession,
} from '../../../utils/craftSessionSync';
import {
  useCanvasViewport,
  useBeadUi,
  useBeadCompletedCells,
  useBeadCompletedColors,
  useBeadProgressActions,
  usePatternLoadActions,
} from '../../../stores';

function sortByColorKey(aKey: string, bKey: string, system: ColorSystem): number {
  const a = getColorKeyByHex(aKey, system);
  const b = getColorKeyByHex(bKey, system);
  const regex = /^([A-Z]+)(\d+)$/i;
  const matchA = a.match(regex);
  const matchB = b.match(regex);
  if (matchA && matchB) {
    const prefixCmp = matchA[1].toUpperCase().localeCompare(matchB[1].toUpperCase());
    if (prefixCmp !== 0) return prefixCmp;
    return parseInt(matchA[2], 10) - parseInt(matchB[2], 10);
  }
  return a.localeCompare(b, 'zh');
}

function countColorProgress(
  mappedPixelData: NonNullable<Pattern['data']['mappedPixelData']>,
  hex: string,
  cellSet: Set<string>,
): { done: number; total: number } {
  const target = hex.toUpperCase();
  let total = 0;
  let done = 0;
  for (let r = 0; r < mappedPixelData.length; r++) {
    const row = mappedPixelData[r];
    if (!row) continue;
    for (let c = 0; c < row.length; c++) {
      const cell = row[c];
      if (!cell || cell.isExternal) continue;
      if ((cell.color || '').toUpperCase() !== target) continue;
      total += 1;
      if (cellSet.has(cellKey(r, c))) done += 1;
    }
  }
  return { done, total };
}

function BeadPageContent() {
  const params = useParams<{ id: string }>();
  const patternId = params.id;
  const [pattern, setPattern] = useState<Pattern | null | undefined>(undefined);
  const [toast, setToast] = useState<string | null>(null);
  const [justCompleted, setJustCompleted] = useState<string | null>(null);
  const [regionSortMode, setRegionSortMode] = useState<RegionSortMode>('nearest');
  const lastClickRef = useRef<{ row: number; col: number } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);

  const completedCellsArr = useBeadCompletedCells(patternId);
  const { toggleCell, setColorCompleted, setCells } = useBeadProgressActions();
  const startedAtRef = useRef<number>(Date.now());
  const syncTimerRef = useRef<number | null>(null);
  const {
    previewZoom,
    canvasOffset,
    panBy,
    highlightHex,
    toggleHighlightColorKey,
    setHighlightColorKey,
    resetViewport,
  } = useBeadUi();
  const { loadPattern, setCurrentPattern } = usePatternLoadActions();

  useEffect(() => {
    const found = loadPattern(patternId);
    setPattern(found ?? null);
    resetViewport();
    startedAtRef.current = Date.now();

    void (async () => {
      const remote = await loadCraftSessionForPattern(patternId);
      const localCells = useBeadProgressStore.getState().getCells(patternId);
      if (!remote) {
        if (found) {
          void pushCraftSession({
            patternId,
            completedCells: localCells,
            patternSnapshot: found.data,
            status: 'active',
          });
        }
        return;
      }
      if (remote.completedCells.length >= localCells.length && remote.completedCells.length > 0) {
        setCells(patternId, remote.completedCells);
      }
    })();

    return () => {
      resetViewport();
      setCurrentPattern(null);
      if (syncTimerRef.current) window.clearTimeout(syncTimerRef.current);
    };
  }, [patternId, loadPattern, setCurrentPattern, resetViewport, setCells]);

  const colorSystem = (pattern?.data.selectedColorSystem || 'MARD') as ColorSystem;
  const mappedPixelData = pattern?.data.mappedPixelData ?? null;
  const gridDimensions = pattern?.data.gridDimensions ?? null;
  const colorCounts = pattern?.data.colorCounts;

  const { fitCanvasToViewport } = useCanvasViewport(viewportRef, {
    gridDimensions,
    mappedPixelData,
  });

  const sortedColors = useMemo(() => {
    if (!colorCounts) return [];
    return Object.keys(colorCounts)
      .filter((hex) => (colorCounts[hex]?.count ?? 0) > 0)
      .sort((a, b) => sortByColorKey(a, b, colorSystem));
  }, [colorCounts, colorSystem]);

  const completedColors = useBeadCompletedColors(patternId, mappedPixelData, sortedColors);

  // debounce 推送制作会话
  useEffect(() => {
    if (!pattern) return;
    if (syncTimerRef.current) window.clearTimeout(syncTimerRef.current);
    syncTimerRef.current = window.setTimeout(() => {
      const elapsedSeconds = Math.floor((Date.now() - startedAtRef.current) / 1000);
      const doneSet = new Set(completedColors.map((c) => c.toUpperCase()));
      const allDone =
        sortedColors.length > 0 && sortedColors.every((hex) => doneSet.has(hex.toUpperCase()));
      void pushCraftSession({
        patternId,
        completedCells: completedCellsArr,
        elapsedSeconds,
        status: allDone ? 'completed' : 'active',
        patternSnapshot: pattern.data,
      });
    }, 800);
    return () => {
      if (syncTimerRef.current) window.clearTimeout(syncTimerRef.current);
    };
  }, [pattern, patternId, completedCellsArr, completedColors, sortedColors]);

  const completedSet = useMemo(
    () => new Set(completedColors.map((c) => c.toUpperCase())),
    [completedColors],
  );

  const completedCellSet = useMemo(() => new Set(completedCellsArr), [completedCellsArr]);

  const cellProgress = useMemo(() => {
    const result: Record<string, { done: number; total: number }> = {};
    if (!mappedPixelData) return result;
    for (const hex of sortedColors) {
      const progress = countColorProgress(mappedPixelData, hex, completedCellSet);
      result[hex.toUpperCase()] = progress;
      result[hex] = progress;
    }
    return result;
  }, [mappedPixelData, sortedColors, completedCellSet]);

  const recommendedCells = useMemo(() => {
    if (!mappedPixelData || !highlightHex || !gridDimensions) return new Set<string>();
    const targetUpper = highlightHex.toUpperCase();
    let exactColor = highlightHex;
    outer: for (let r = 0; r < mappedPixelData.length; r++) {
      const row = mappedPixelData[r];
      if (!row) continue;
      for (let c = 0; c < row.length; c++) {
        const cell = row[c];
        if (cell && !cell.isExternal && (cell.color || '').toUpperCase() === targetUpper) {
          exactColor = cell.color;
          break outer;
        }
      }
    }
    const regions = getAllConnectedRegions(mappedPixelData, exactColor).filter(
      (region) => !isRegionCompleted(region, completedCellSet),
    );
    if (regions.length === 0) return new Set<string>();

    const ref = lastClickRef.current ?? {
      row: Math.floor(gridDimensions.M / 2),
      col: Math.floor(gridDimensions.N / 2),
    };

    let sorted = regions;
    if (regionSortMode === 'nearest') {
      sorted = sortRegionsByDistance([...regions], ref);
    } else if (regionSortMode === 'largest') {
      sorted = sortRegionsBySize([...regions]);
    } else {
      sorted = sortRegionsByEdge([...regions], gridDimensions.M, gridDimensions.N);
    }

    const first = sorted[0] ?? [];
    return new Set(first.map(({ row, col }) => cellKey(row, col)));
  }, [mappedPixelData, highlightHex, gridDimensions, completedCellSet, regionSortMode]);

  const doneCount = sortedColors.filter((hex) => completedSet.has(hex.toUpperCase())).length;
  const allDone = sortedColors.length > 0 && doneCount === sortedColors.length;

  useAppNavSubtitle(pattern ? `拼豆 · ${pattern.name}` : '拼豆制作');

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 1800);
    return () => window.clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!justCompleted) return;
    const t = window.setTimeout(() => setJustCompleted(null), 1200);
    return () => window.clearTimeout(t);
  }, [justCompleted]);

  const advanceHighlightIfNeeded = useCallback(
    (hexJustDone: string, doneColors: Iterable<string>) => {
      if (highlightHex?.toUpperCase() !== hexJustDone.toUpperCase()) return;
      const doneUpper = new Set(Array.from(doneColors, (c) => c.toUpperCase()));
      const nextColor = sortedColors.find((c) => !doneUpper.has(c.toUpperCase()));
      setHighlightColorKey(nextColor ?? null);
    },
    [highlightHex, sortedColors, setHighlightColorKey],
  );

  const toggleComplete = (hex: string, next: boolean) => {
    if (!pattern) return;
    setColorCompleted(pattern.id, hex, next, mappedPixelData);
    if (next) {
      setJustCompleted(hex.toUpperCase());
      setToast(`完成 ${getColorKeyByHex(hex, colorSystem)} 🎉`);
      const updated = new Set(completedColors.map((c) => c.toUpperCase()));
      updated.add(hex.toUpperCase());
      advanceHighlightIfNeeded(hex, updated);
    }
  };

  const handleInteraction = useCallback(
    (
      clientX: number,
      clientY: number,
      _pageX: number,
      _pageY: number,
      isClick: boolean,
      isTouchEnd?: boolean,
    ) => {
      if ((!isClick && !isTouchEnd) || !pattern || !mappedPixelData || !canvasRef.current) return;
      if (clientX === 0 && clientY === 0) return;

      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const canvasX = (clientX - rect.left) * scaleX;
      const canvasY = (clientY - rect.top) * scaleY;
      const cellSize = Math.max(4, Math.round(16 * previewZoom));
      const axisSize = Math.max(18, Math.min(36, Math.round(cellSize * 1.4)));
      const col = Math.floor((canvasX - axisSize) / cellSize);
      const row = Math.floor((canvasY - axisSize) / cellSize);
      const M = mappedPixelData.length;
      const N = mappedPixelData[0]?.length ?? 0;
      if (row < 0 || col < 0 || row >= M || col >= N) return;

      const cell = mappedPixelData[row]?.[col];
      if (!cell || cell.isExternal) return;

      const hex = (cell.color || '').toUpperCase();
      if (!hex) return;

      if (highlightHex?.toUpperCase() !== hex) {
        setHighlightColorKey(cell.color);
      }

      lastClickRef.current = { row, col };
      const beforeDone = completedSet.has(hex);
      const { cells } = toggleCell(pattern.id, cellKey(row, col));
      const cellSet = new Set(cells);
      const { done, total } = countColorProgress(mappedPixelData, hex, cellSet);
      const nowDone = total > 0 && done === total;

      if (nowDone && !beforeDone) {
        setJustCompleted(hex);
        setToast(`完成 ${getColorKeyByHex(hex, colorSystem)} 🎉`);
        const updated = new Set(completedColors.map((c) => c.toUpperCase()));
        updated.add(hex);
        advanceHighlightIfNeeded(hex, updated);
      }
    },
    [
      pattern,
      mappedPixelData,
      previewZoom,
      highlightHex,
      setHighlightColorKey,
      toggleCell,
      completedSet,
      completedColors,
      colorSystem,
      advanceHighlightIfNeeded,
    ],
  );

  if (pattern === undefined) {
    return (
      <main className="platform-page">
        <p className="empty-state">加载中…</p>
      </main>
    );
  }

  if (!pattern || !mappedPixelData || !gridDimensions || gridDimensions.N <= 0) {
    return (
      <main className="platform-page">
        <p className="empty-state">图纸不存在或尚未生成像素数据。</p>
        <Link href="/dashboard" className="primary-button" style={{ marginTop: 16, display: 'inline-flex' }}>
          返回我的图纸
        </Link>
      </main>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="mb-2 flex shrink-0 flex-wrap items-center justify-between gap-2 px-0.5">
        <div className="min-w-0">
          <p className="text-sm text-[#8a6a4a]">
            进度{' '}
            <span className="font-semibold tabular-nums text-[#3a2416]">
              {doneCount}/{sortedColors.length}
            </span>{' '}
            色
            {allDone ? <span className="ml-2 font-semibold text-[#c47a2c]">全部完成！</span> : null}
          </p>
          <p className="mt-0.5 text-[11px] text-[#a08060]">
            点格子标记完成 · 空格拖拽平移 · 推荐区橙色描边
          </p>
        </div>
        <BeadPageToolbar patternId={patternId} onFitCanvas={fitCanvasToViewport} />
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-hidden lg:grid-cols-[minmax(0,1fr)_240px] xl:grid-cols-[minmax(0,1fr)_260px]">
        <div
          ref={viewportRef}
          className="relative min-h-0 min-w-0 overflow-hidden rounded-xl border border-[#eadfce] bg-[#eef0f3]"
        >
          <div className="absolute inset-0 overflow-hidden">
            <div
              className="absolute left-0 top-0"
              style={{ transform: `translate(${canvasOffset.x}px, ${canvasOffset.y}px)` }}
            >
              <div className="overflow-hidden rounded-md bg-white shadow-sm ring-1 ring-black/5">
                <PixelatedPreviewCanvas
                  canvasRef={canvasRef}
                  mappedPixelData={mappedPixelData}
                  gridDimensions={gridDimensions}
                  onInteraction={handleInteraction}
                  highlightColorKey={highlightHex}
                  persistentHighlight
                  selectedColorSystem={colorSystem}
                  previewZoom={previewZoom}
                  toolMode="select"
                  selectedCells={new Set()}
                  onPanBy={panBy}
                  completedCells={completedCellSet}
                  recommendedCells={recommendedCells}
                />
              </div>
            </div>
          </div>

          {allDone && (
            <div className="pointer-events-none absolute inset-x-0 top-4 z-20 flex justify-center">
              <div className="rounded-full bg-[#c47a2c] px-4 py-2 text-sm font-semibold text-white shadow-lg">
                太棒了，整幅图纸的颜色都拼完了
              </div>
            </div>
          )}
        </div>

        <BeadColorList
          sortedColors={sortedColors}
          colorCounts={colorCounts}
          colorSystem={colorSystem}
          highlightHex={highlightHex}
          completedSet={completedSet}
          cellProgress={cellProgress}
          justCompleted={justCompleted}
          regionSortMode={regionSortMode}
          onRegionSortModeChange={setRegionSortMode}
          onToggleHighlight={toggleHighlightColorKey}
          onToggleComplete={toggleComplete}
        />
      </div>

      {toast && (
        <div
          className="fixed bottom-20 left-1/2 z-[200] -translate-x-1/2 rounded-lg bg-[#3a2416] px-4 py-2 text-sm text-white shadow-lg"
          role="status"
          aria-live="polite"
        >
          {toast}
        </div>
      )}
    </div>
  );
}

export default function BeadPage() {
  return (
    <RequireAuth>
      <BeadPageContent />
    </RequireAuth>
  );
}
