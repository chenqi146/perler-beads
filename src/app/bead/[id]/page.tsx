'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import RequireAuth from '../../../components/RequireAuth';
import { useAppNavSubtitle } from '../../../components/shell';
import {
  BeadPageToolbar,
  BeadColorList,
  GRID_INTERVAL_OPTIONS,
} from '../../../components/editor';
import PixelatedPreviewCanvas, { cellKey } from '../../../components/PixelatedPreviewCanvas';

import { getColorKeyByHex, type ColorSystem } from '../../../domain/palette';
import {
  recountColors,
  transparentColorData,
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
  measureCanvasPixels,
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

const BEAD_GRID_INTERVAL_KEY = 'perler-bead-grid-interval';
const BEAD_HIGHLIGHT_FADE_KEY = 'perler-bead-highlight-fade';
const DEFAULT_HIGHLIGHT_FADE = 84;

function readStoredGridInterval(): number {
  if (typeof window === 'undefined') return 10;
  const raw = localStorage.getItem(BEAD_GRID_INTERVAL_KEY);
  const n = raw ? parseInt(raw, 10) : NaN;
  return (GRID_INTERVAL_OPTIONS as readonly number[]).includes(n) ? n : 10;
}

function readStoredHighlightFade(): number {
  if (typeof window === 'undefined') return DEFAULT_HIGHLIGHT_FADE;
  const raw = localStorage.getItem(BEAD_HIGHLIGHT_FADE_KEY);
  const n = raw ? parseInt(raw, 10) : NaN;
  if (!Number.isFinite(n)) return DEFAULT_HIGHLIGHT_FADE;
  return Math.max(0, Math.min(100, n));
}

function BeadPageContent() {
  const params = useParams<{ id: string }>();
  const patternId = params.id;
  const [pattern, setPattern] = useState<Pattern | null | undefined>(undefined);
  const [toast, setToast] = useState<string | null>(null);
  const [justCompleted, setJustCompleted] = useState<string | null>(null);
  const [gridInterval, setGridInterval] = useState(10);
  const [highlightFadePercent, setHighlightFadePercent] = useState(DEFAULT_HIGHLIGHT_FADE);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);

  const completedCellsArr = useBeadCompletedCells(patternId);
  const { toggleCell, setColorCompleted, setCells } = useBeadProgressActions();
  const startedAtRef = useRef<number>(Date.now());
  const syncTimerRef = useRef<number | null>(null);
  const {
    previewZoom,
    setPreviewZoom,
    canvasOffset,
    setCanvasOffset,
    panBy,
    highlightHex,
    toggleHighlightColorKey,
    setHighlightColorKey,
    resetViewport,
  } = useBeadUi();
  const { loadPattern, setCurrentPattern, savePattern } = usePatternLoadActions();

  useEffect(() => {
    setGridInterval(readStoredGridInterval());
    setHighlightFadePercent(readStoredHighlightFade());
  }, []);

  const handleGridIntervalChange = useCallback((interval: number) => {
    setGridInterval(interval);
    try {
      localStorage.setItem(BEAD_GRID_INTERVAL_KEY, String(interval));
    } catch {
      // ignore
    }
  }, []);

  const handleHighlightFadeChange = useCallback((percent: number) => {
    const next = Math.max(0, Math.min(100, percent));
    setHighlightFadePercent(next);
    try {
      localStorage.setItem(BEAD_HIGHLIGHT_FADE_KEY, String(next));
    } catch {
      // ignore
    }
  }, []);

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

  // 滚轮缩放画布
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      if (!gridDimensions) return;
      event.preventDefault();
      const delta = event.deltaY > 0 ? -0.1 : 0.1;
      const next = Math.max(0.25, Math.min(3, Math.round((previewZoom + delta) * 100) / 100));
      if (next === previewZoom) return;

      const rect = el.getBoundingClientRect();
      const mx = event.clientX - rect.left;
      const my = event.clientY - rect.top;
      const { width: oldW, height: oldH } = measureCanvasPixels(
        gridDimensions.N,
        gridDimensions.M,
        previewZoom,
      );
      const { width: newW, height: newH } = measureCanvasPixels(
        gridDimensions.N,
        gridDimensions.M,
        next,
      );
      const contentX = mx - canvasOffset.x;
      const contentY = my - canvasOffset.y;
      const scale = newW / Math.max(1, oldW);
      setPreviewZoom(next);
      setCanvasOffset({
        x: Math.round(mx - contentX * scale),
        y: Math.round(my - contentY * (newH / Math.max(1, oldH))),
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [previewZoom, canvasOffset, gridDimensions, setPreviewZoom, setCanvasOffset]);

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

  const handleDeleteColor = useCallback(
    (hex: string) => {
      if (!pattern || !mappedPixelData) return;
      const displayKey = getColorKeyByHex(hex, colorSystem);
      const count = colorCounts?.[hex]?.count ?? colorCounts?.[hex.toUpperCase()]?.count ?? 0;
      if (
        !window.confirm(
          `确定删除色号 ${displayKey}？将擦除图纸上全部 ${count} 粒该颜色，此操作会写入图纸。`,
        )
      ) {
        return;
      }

      const target = hex.toUpperCase();
      let replaceCount = 0;
      const newPixelData = mappedPixelData.map((row) =>
        row.map((cell) => {
          if (!cell || cell.isExternal) return { ...cell };
          if ((cell.color || '').toUpperCase() !== target) return { ...cell };
          replaceCount += 1;
          return { ...transparentColorData };
        }),
      );
      if (replaceCount === 0) {
        setToast(`${displayKey} 无需删除`);
        return;
      }

      const { counts, total } = recountColors(newPixelData);
      const nextData = {
        ...pattern.data,
        mappedPixelData: newPixelData,
        colorCounts: counts,
        totalBeadCount: total,
      };
      const saved = savePattern(
        {
          name: pattern.name,
          description: pattern.description,
          tags: pattern.tags,
          visibility: pattern.visibility,
          data: nextData,
        },
        pattern.id,
      );
      setPattern(saved);

      const cleaned = completedCellsArr.filter((key) => {
        const [r, c] = key.split(',').map(Number);
        const cell = newPixelData[r]?.[c];
        return Boolean(cell && !cell.isExternal);
      });
      setCells(pattern.id, cleaned);

      if (highlightHex?.toUpperCase() === target) {
        setHighlightColorKey(null);
      }
      setToast(`已删除 ${displayKey}（${replaceCount} 粒）`);
    },
    [
      pattern,
      mappedPixelData,
      colorSystem,
      colorCounts,
      savePattern,
      completedCellsArr,
      setCells,
      highlightHex,
      setHighlightColorKey,
    ],
  );

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

  const handleZoomOut = () =>
    setPreviewZoom(Math.max(0.25, Math.round((previewZoom - 0.25) * 100) / 100));
  const handleZoomIn = () =>
    setPreviewZoom(Math.min(3, Math.round((previewZoom + 0.25) * 100) / 100));
  const handleResetZoom = () => {
    setPreviewZoom(1);
    requestAnimationFrame(() => {
      const el = viewportRef.current;
      if (!el || !gridDimensions) return;
      const { width, height } = measureCanvasPixels(gridDimensions.N, gridDimensions.M, 1);
      setCanvasOffset({
        x: Math.round((el.clientWidth - width) / 2),
        y: Math.round((el.clientHeight - height) / 2),
      });
    });
  };

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
            点格子标记完成 · 滚轮缩放 · 空格拖拽平移
          </p>
        </div>
        <BeadPageToolbar
          patternId={patternId}
          previewZoom={previewZoom}
          canFit
          onFitCanvas={fitCanvasToViewport}
          onZoomOut={handleZoomOut}
          onResetZoom={handleResetZoom}
          onZoomIn={handleZoomIn}
        />
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
                  gridInterval={gridInterval}
                  highlightFade={highlightFadePercent / 100}
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
          gridInterval={gridInterval}
          onGridIntervalChange={handleGridIntervalChange}
          highlightFadePercent={highlightFadePercent}
          onHighlightFadeChange={handleHighlightFadeChange}
          onToggleHighlight={toggleHighlightColorKey}
          onToggleComplete={toggleComplete}
          onDeleteColor={handleDeleteColor}
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
