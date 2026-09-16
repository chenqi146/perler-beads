'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import RequireAuth from '../../../components/RequireAuth';
import { useAppNavSubtitle, useImmersiveChrome } from '../../../components/shell';
import {
  BeadPageToolbar,
  BeadColorList,
  BeadColorStrip,
  BeadCraftSettings,
  BeadWorkPhotoSheet,
  GRID_INTERVAL_OPTIONS,
} from '../../../components/editor';
import { Overlay } from '../../../components/ui/Overlay';
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
  applyZoomAtPoint,
  useBeadUi,
  useBeadCompletedCells,
  useBeadCompletedColors,
  useBeadProgressActions,
  usePatternLoadActions,
  measureCanvasPixels,
  useEditorUiStore,
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
const BEAD_SHOW_CELL_KEYS_KEY = 'perler-bead-show-cell-keys';
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

function readStoredShowCellKeys(): boolean {
  if (typeof window === 'undefined') return true;
  const raw = localStorage.getItem(BEAD_SHOW_CELL_KEYS_KEY);
  if (raw === null) return true;
  return raw === '1' || raw === 'true';
}

function BeadPageContent() {
  const params = useParams<{ id: string }>();
  const patternId = params.id;
  const [pattern, setPattern] = useState<Pattern | null | undefined>(undefined);
  const [toast, setToast] = useState<string | null>(null);
  const [justCompleted, setJustCompleted] = useState<string | null>(null);
  const [gridInterval, setGridInterval] = useState(10);
  const [highlightFadePercent, setHighlightFadePercent] = useState(DEFAULT_HIGHLIGHT_FADE);
  const [showCellKeys, setShowCellKeys] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [immersive, setImmersive] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const canvasPanRef = useRef<{ x: number; y: number; pointerId: number } | null>(null);
  const spaceHeldRef = useRef(false);

  const completedCellsArr = useBeadCompletedCells(patternId);
  const { markCell, setColorCompleted, setCells } = useBeadProgressActions();
  const startedAtRef = useRef<number>(Date.now());
  const syncTimerRef = useRef<number | null>(null);
  const lastMarkRef = useRef<{ key: string; at: number } | null>(null);
  const {
    previewZoom,
    setPreviewZoom,
    canvasOffset,
    setCanvasOffset,
    panBy,
    highlightHex,
    setHighlightColorKey,
    toggleHighlightColorKey,
    resetViewport,
  } = useBeadUi();
  const { loadPattern, setCurrentPattern, savePattern } = usePatternLoadActions();

  useEffect(() => {
    setGridInterval(readStoredGridInterval());
    setHighlightFadePercent(readStoredHighlightFade());
    setShowCellKeys(readStoredShowCellKeys());
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

  const handleShowCellKeysChange = useCallback((show: boolean) => {
    setShowCellKeys(show);
    try {
      localStorage.setItem(BEAD_SHOW_CELL_KEYS_KEY, show ? '1' : '0');
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
      // 合并本地与远端，避免异步回写覆盖刚点上的格子
      const merged = Array.from(new Set([...localCells, ...remote.completedCells]));
      if (merged.length > localCells.length) {
        setCells(patternId, merged);
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
  useImmersiveChrome(immersive);

  useEffect(() => {
    if (!immersive) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setImmersive(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [immersive]);

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

  // 与编辑模式一致：空格按住可拖动画布
  useEffect(() => {
    const isTypingTarget = (target: EventTarget | null) => {
      const el = target as HTMLElement | null;
      const tag = el?.tagName?.toLowerCase();
      return tag === 'input' || tag === 'textarea' || tag === 'select' || !!el?.isContentEditable;
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || isTypingTarget(event.target)) return;
      spaceHeldRef.current = true;
      event.preventDefault();
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') spaceHeldRef.current = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

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

      // 拼豆：点格只选中当前色（不高亮切换成取消），并只标记完成、不取消
      setHighlightColorKey(cell.color);

      const key = cellKey(row, col);
      const now = Date.now();
      if (lastMarkRef.current?.key === key && now - lastMarkRef.current.at < 450) {
        return;
      }
      lastMarkRef.current = { key, at: now };

      const beforeDone = completedSet.has(hex);
      const { cells, added } = markCell(pattern.id, key);
      if (!added) return;

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
      setHighlightColorKey,
      markCell,
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

  const handlePinchZoom = useCallback((scale: number, centerClient: { x: number; y: number }) => {
    const el = viewportRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const ui = useEditorUiStore.getState();
    applyZoomAtPoint({
      currentZoom: ui.previewZoom,
      nextZoom: ui.previewZoom * scale,
      offset: ui.canvasOffset,
      point: { x: centerClient.x - rect.left, y: centerClient.y - rect.top },
      setPreviewZoom: ui.setPreviewZoom,
      setCanvasOffset: ui.setCanvasOffset,
    });
  }, []);

  const handleToggleImmersive = useCallback(() => {
    setImmersive((prev) => !prev);
  }, []);

  useEffect(() => {
    if (!immersive) return;
    const id = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        fitCanvasToViewport();
      });
    });
    return () => window.cancelAnimationFrame(id);
  }, [immersive, fitCanvasToViewport]);

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
      {!immersive ? (
        <div className="mb-2 flex shrink-0 flex-wrap items-center justify-between gap-2 px-0.5">
          <div className="min-w-0">
            <p className="text-sm text-[#8a6a4a]">
              进度{' '}
              <span className="font-semibold tabular-nums text-[#3a2416]">
                {doneCount}/{sortedColors.length}
              </span>{' '}
              色
              {allDone ? <span className="ml-2 font-semibold text-[#c47a2c]">拼完了</span> : null}
            </p>
            {sortedColors.length > 0 ? (
              <div
                className="mt-1.5 h-1.5 max-w-[12rem] overflow-hidden rounded-full bg-[#eadfce]"
                role="progressbar"
                aria-valuenow={doneCount}
                aria-valuemin={0}
                aria-valuemax={sortedColors.length}
                aria-label="颜色完成进度"
              >
                <div
                  className="h-full rounded-full bg-[#c47a2c] motion-safe:transition-[width] motion-safe:duration-300 motion-safe:ease-out"
                  style={{
                    width: `${Math.round((doneCount / sortedColors.length) * 100)}%`,
                  }}
                />
              </div>
            ) : null}
            <p className="mt-1.5 hidden text-[11px] text-[#a08060] lg:block">
              点格子标记完成 · 滚轮平移 · 空格拖拽 · 按钮缩放
            </p>
            <p className="mt-1.5 text-[11px] text-[#a08060] lg:hidden">
              拖动画布 · 点格完成 · 双指缩放
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
            onOpenPhoto={() => setPhotoOpen(true)}
            immersive={immersive}
            onToggleImmersive={handleToggleImmersive}
          />
        </div>
      ) : null}

      <div
        className={[
          'grid min-h-0 flex-1 overflow-hidden',
          immersive
            ? 'grid-cols-1 gap-0'
            : 'grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_240px] xl:grid-cols-[minmax(0,1fr)_260px]',
        ].join(' ')}
      >
        <div
          className={[
            'relative flex min-h-0 min-w-0 flex-col overflow-hidden',
            immersive ? 'gap-0' : 'gap-2',
          ].join(' ')}
        >
          <div
            ref={viewportRef}
            className={[
              'relative min-h-0 min-w-0 flex-1 overflow-hidden bg-[#f3ebe0]',
              immersive ? 'rounded-none border-0' : 'rounded-xl border border-[#eadfce]',
            ].join(' ')}
          >
            {immersive ? (
              <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-2 p-2 sm:p-3">
                <div
                  className="pointer-events-auto flex max-w-[min(100%,14rem)] items-center gap-2 rounded-2xl border border-[#eadfce]/90 bg-[#fffaf3]/92 px-3 py-2 shadow-[0_8px_24px_rgba(90,52,24,0.1)] backdrop-blur-md"
                  style={{ marginTop: 'env(safe-area-inset-top)' }}
                >
                  <div className="min-w-0">
                    <p className="text-[11px] leading-none text-[#8a6a4a]">进度</p>
                    <p className="mt-1 text-sm font-semibold tabular-nums text-[#3a2416]">
                      {doneCount}/{sortedColors.length}
                      <span className="ml-1 font-normal text-[#8a6a4a]">色</span>
                      {allDone ? <span className="ml-1.5 text-[#c47a2c]">拼完了</span> : null}
                    </p>
                    {sortedColors.length > 0 ? (
                      <div
                        className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-[#eadfce]"
                        role="progressbar"
                        aria-valuenow={doneCount}
                        aria-valuemin={0}
                        aria-valuemax={sortedColors.length}
                        aria-label="颜色完成进度"
                      >
                        <div
                          className="h-full rounded-full bg-[#c47a2c] motion-safe:transition-[width] motion-safe:duration-300 motion-safe:ease-out"
                          style={{
                            width: `${Math.round((doneCount / sortedColors.length) * 100)}%`,
                          }}
                        />
                      </div>
                    ) : null}
                  </div>
                </div>
                <div
                  className="pointer-events-auto"
                  style={{ marginTop: 'env(safe-area-inset-top)' }}
                >
                  <BeadPageToolbar
                    patternId={patternId}
                    previewZoom={previewZoom}
                    canFit
                    onFitCanvas={fitCanvasToViewport}
                    onZoomOut={handleZoomOut}
                    onResetZoom={handleResetZoom}
                    onZoomIn={handleZoomIn}
                    immersive={immersive}
                    onToggleImmersive={handleToggleImmersive}
                    compact
                  />
                </div>
              </div>
            ) : null}

            <div
              className="absolute inset-0 cursor-grab overflow-hidden active:cursor-grabbing"
              onWheel={(event) => {
                event.preventDefault();
                panBy(-event.deltaX, -event.deltaY);
              }}
              onPointerDown={(event) => {
                if (event.pointerType === 'touch') return;
                if (event.button !== 0) return;
                const onDrawing = !!(event.target as HTMLElement).closest('canvas');
                // 图纸上默认点格完成；按住空格时改为拖动画布（桌面）
                if (onDrawing && !spaceHeldRef.current) return;
                event.preventDefault();
                canvasPanRef.current = {
                  x: event.clientX,
                  y: event.clientY,
                  pointerId: event.pointerId,
                };
                event.currentTarget.setPointerCapture(event.pointerId);
              }}
              onPointerMove={(event) => {
                const pan = canvasPanRef.current;
                if (!pan || pan.pointerId !== event.pointerId) return;
                const dx = event.clientX - pan.x;
                const dy = event.clientY - pan.y;
                canvasPanRef.current = { ...pan, x: event.clientX, y: event.clientY };
                panBy(dx, dy);
              }}
              onPointerUp={(event) => {
                if (canvasPanRef.current?.pointerId === event.pointerId) {
                  canvasPanRef.current = null;
                }
              }}
              onPointerCancel={() => {
                canvasPanRef.current = null;
              }}
            >
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
                    toolMode="bead"
                    selectedCells={new Set()}
                    onPanBy={panBy}
                    onPinchZoom={handlePinchZoom}
                    gridInterval={gridInterval}
                    highlightFade={highlightFadePercent / 100}
                    showCellKeys={showCellKeys}
                  />
                </div>
              </div>
            </div>

            {allDone && (
              <div className="pointer-events-none absolute inset-x-0 top-4 z-20 flex justify-center px-3">
                <div
                  className={[
                    'rounded-2xl border border-[#eadfce] bg-[#fffaf3]/95 px-4 py-2 text-sm font-semibold text-[#3a2416] shadow-[0_8px_24px_rgba(90,52,24,0.12)]',
                    immersive ? 'mt-16 sm:mt-14' : '',
                  ].join(' ')}
                >
                  整幅图纸的颜色都拼完了
                </div>
              </div>
            )}
            {allDone && (
              <div className="absolute inset-x-0 bottom-3 z-20 flex justify-center px-3 lg:hidden">
                <button
                  type="button"
                  onClick={() => setPhotoOpen(true)}
                  className="pointer-events-auto inline-flex h-11 touch-manipulation items-center rounded-2xl bg-[#c47a2c] px-5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(196,122,44,0.28)]"
                >
                  拍照留档
                </button>
              </div>
            )}
          </div>

          {/* 底栏色带：普通模式仅移动端；全屏时桌面也显示，方便专心拼 */}
          <div
            className={[
              'flex shrink-0 items-stretch gap-2 border-[#eadfce] bg-[#fffaf3] p-2 shadow-[0_-4px_18px_rgba(90,52,24,0.04)]',
              immersive
                ? 'rounded-none border-t'
                : 'rounded-2xl border lg:hidden',
            ].join(' ')}
            style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
          >
            {highlightHex ? (
              <button
                type="button"
                onClick={() => setHighlightColorKey(null)}
                className="flex h-14 w-14 shrink-0 touch-manipulation flex-col items-center justify-center gap-0.5 rounded-xl border border-[#c47a2c] bg-[#fff4e6] px-1"
                aria-label={`取消选中 ${getColorKeyByHex(highlightHex, colorSystem)}`}
              >
                <span
                  className="h-6 w-6 rounded-md border border-black/10"
                  style={{
                    backgroundColor:
                      colorCounts?.[highlightHex]?.color ??
                      colorCounts?.[highlightHex.toUpperCase()]?.color ??
                      highlightHex,
                  }}
                  aria-hidden="true"
                />
                <span className="max-w-[3.25rem] truncate font-mono text-[10px] text-[#3a2416]">
                  {getColorKeyByHex(highlightHex, colorSystem)}
                </span>
              </button>
            ) : null}
            <div className="min-w-0 flex-1">
              <BeadColorStrip
                sortedColors={sortedColors}
                colorCounts={colorCounts}
                colorSystem={colorSystem}
                highlightHex={highlightHex}
                completedSet={completedSet}
                cellProgress={cellProgress}
                justCompleted={justCompleted}
                onToggleHighlight={toggleHighlightColorKey}
                onToggleComplete={toggleComplete}
              />
            </div>
            <div className="flex shrink-0 flex-col gap-1">
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                className="inline-flex h-11 w-11 touch-manipulation items-center justify-center rounded-xl border border-[#e0d0bc] bg-white text-[#5c4030]"
                aria-label="拼豆设置"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" aria-hidden="true">
                  <path fillRule="evenodd" d="M7.84 1.804A1 1 0 018.82 1h2.36a1 1 0 01.98.804l.331 1.652a6.993 6.993 0 011.929.943l1.598-.54a1 1 0 011.186.447l1.18 2.044a1 1 0 01-.205 1.251l-1.267 1.114a7.047 7.047 0 010 1.881l1.267 1.114a1 1 0 01.206 1.25l-1.18 2.045a1 1 0 01-1.187.447l-1.598.54a6.993 6.993 0 01-1.929.943l-.33 1.652a1 1 0 01-.98.804H8.82a1 1 0 01-.98-.804l-.331-1.652a6.993 6.993 0 01-1.929-.943l-1.598.54a1 1 0 01-1.186-.447l-1.18-2.044a1 1 0 01.205-1.251l1.267-1.114a7.047 7.047 0 010-1.881L1.821 7.773a1 1 0 01-.206-1.25l1.18-2.045a1 1 0 011.187-.447l1.598.54a6.993 6.993 0 011.929-.943l.33-1.652zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => setPhotoOpen(true)}
                className="inline-flex h-11 w-11 touch-manipulation items-center justify-center rounded-xl border border-[#e0d0bc] bg-white text-[#5c4030]"
                aria-label="拍照上传作品"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" aria-hidden="true">
                  <path d="M4 5a2 2 0 00-2 2v7a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2h-1.172a2 2 0 01-1.414-.586l-.828-.828A2 2 0 0010.172 3H9.828a2 2 0 00-1.414.586l-.828.828A2 2 0 016.172 5H4zm6 9a3 3 0 100-6 3 3 0 000 6z" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {!immersive ? (
          <div className="hidden min-h-0 lg:block">
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
              showCellKeys={showCellKeys}
              onShowCellKeysChange={handleShowCellKeysChange}
              onToggleHighlight={toggleHighlightColorKey}
              onToggleComplete={toggleComplete}
              onDeleteColor={handleDeleteColor}
            />
          </div>
        ) : null}
      </div>

      {settingsOpen ? (
        <Overlay
          labelledBy="bead-mobile-settings-title"
          placement="sheet"
          onClose={() => setSettingsOpen(false)}
        >
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="flex shrink-0 items-center justify-between border-b border-[#eadfce] px-4 py-3">
              <h2 id="bead-mobile-settings-title" className="text-base font-semibold text-[#3a2416]">
                拼豆设置
              </h2>
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                className="inline-flex h-11 min-w-11 touch-manipulation items-center justify-center rounded-xl text-sm text-[#8a6a4a]"
              >
                关闭
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4">
              <BeadCraftSettings
                gridInterval={gridInterval}
                onGridIntervalChange={handleGridIntervalChange}
                highlightFadePercent={highlightFadePercent}
                onHighlightFadeChange={handleHighlightFadeChange}
                showCellKeys={showCellKeys}
                onShowCellKeysChange={handleShowCellKeysChange}
                idPrefix="bead-mobile"
              />
              <div className="border-t border-[#eadfce] pt-3">
                <p className="mb-2 text-[11px] text-[#8a6a4a]">删除色号（擦除该色全部格子）</p>
                <div className="max-h-48 space-y-1 overflow-y-auto overscroll-contain">
                  {sortedColors.map((hex) => {
                    const displayKey = getColorKeyByHex(hex, colorSystem);
                    const color = colorCounts?.[hex]?.color ?? hex;
                    return (
                      <button
                        key={hex}
                        type="button"
                        onClick={() => {
                          handleDeleteColor(hex);
                          setSettingsOpen(false);
                        }}
                        className="flex min-h-11 w-full touch-manipulation items-center gap-2 rounded-xl px-2 text-left text-sm text-[#5c4030] hover:bg-[#f3e0d0]"
                      >
                        <span
                          className="h-5 w-5 shrink-0 rounded-md border border-black/10"
                          style={{ backgroundColor: color }}
                          aria-hidden="true"
                        />
                        <span className="font-mono">{displayKey}</span>
                        <span className="ml-auto text-[11px] text-[#b33b2a]">删除</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </Overlay>
      ) : null}

      <BeadWorkPhotoSheet
        open={photoOpen}
        onClose={() => setPhotoOpen(false)}
        pattern={pattern}
        completedCells={completedCellsArr}
        allDone={allDone}
        onToast={setToast}
        onSaved={() => setToast('作品已保存，可在「我的作品」查看')}
      />

      {toast && (
        <div
          className={[
            'fixed left-1/2 z-[200] -translate-x-1/2 rounded-lg bg-[#3a2416] px-4 py-2 text-sm text-white shadow-lg',
            immersive ? 'bottom-28' : 'bottom-24 lg:bottom-20',
          ].join(' ')}
          role="status"
          aria-live="polite"
          style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
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
