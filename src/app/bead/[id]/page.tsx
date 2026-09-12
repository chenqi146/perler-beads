'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import RequireAuth from '../../../components/RequireAuth';
import { useAppNavSubtitle } from '../../../components/shell';
import { BeadPageToolbar, BeadColorList } from '../../../components/editor';
import PixelatedPreviewCanvas from '../../../components/PixelatedPreviewCanvas';
import { getColorKeyByHex, type ColorSystem } from '../../../domain/palette';
import type { Pattern } from '../../../types/platform';
import {
  useCanvasViewport,
  useBeadUi,
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

function BeadPageContent() {
  const params = useParams<{ id: string }>();
  const patternId = params.id;
  const [pattern, setPattern] = useState<Pattern | null | undefined>(undefined);
  const [toast, setToast] = useState<string | null>(null);
  const [justCompleted, setJustCompleted] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const panRef = useRef<{ x: number; y: number; pointerId: number } | null>(null);

  const completedColors = useBeadCompletedColors(patternId);
  const { setCompleted } = useBeadProgressActions();
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
    return () => {
      resetViewport();
      setCurrentPattern(null);
    };
  }, [patternId, loadPattern, setCurrentPattern, resetViewport]);

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

  const completedSet = useMemo(
    () => new Set(completedColors.map((c) => c.toUpperCase())),
    [completedColors],
  );

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

  const toggleComplete = (hex: string, next: boolean) => {
    if (!pattern) return;
    const updated = setCompleted(pattern.id, hex, next);
    if (next) {
      setJustCompleted(hex.toUpperCase());
      const key = getColorKeyByHex(hex, colorSystem);
      setToast(`完成 ${key} 🎉`);
      if (highlightHex?.toUpperCase() === hex.toUpperCase()) {
        const nextColor = sortedColors.find(
          (c) =>
            c.toUpperCase() !== hex.toUpperCase() &&
            !updated.map((u) => u.toUpperCase()).includes(c.toUpperCase()),
        );
        setHighlightColorKey(nextColor ?? null);
      }
    }
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
          <p className="mt-0.5 text-[11px] text-[#a08060]">点色号高亮 · 勾选标记完成 · 拖动画布空白处平移</p>
        </div>
        <BeadPageToolbar patternId={patternId} onFitCanvas={fitCanvasToViewport} />
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-hidden lg:grid-cols-[minmax(0,1fr)_240px] xl:grid-cols-[minmax(0,1fr)_260px]">
        <div
          ref={viewportRef}
          className="relative min-h-0 min-w-0 overflow-hidden rounded-xl border border-[#eadfce] bg-[#eef0f3]"
        >
          <div
            className="absolute inset-0 cursor-grab overflow-hidden active:cursor-grabbing"
            onWheel={(event) => {
              event.preventDefault();
              panBy(-event.deltaX, -event.deltaY);
            }}
            onPointerDown={(event) => {
              if (event.button !== 0) return;
              event.preventDefault();
              panRef.current = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => {
              const pan = panRef.current;
              if (!pan || pan.pointerId !== event.pointerId) return;
              const dx = event.clientX - pan.x;
              const dy = event.clientY - pan.y;
              panRef.current = { ...pan, x: event.clientX, y: event.clientY };
              panBy(dx, dy);
            }}
            onPointerUp={(event) => {
              if (panRef.current?.pointerId === event.pointerId) panRef.current = null;
            }}
            onPointerCancel={() => {
              panRef.current = null;
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
                  isManualColoringMode={false}
                  onInteraction={() => {}}
                  highlightColorKey={highlightHex}
                  persistentHighlight
                  selectedColorSystem={colorSystem}
                  previewZoom={previewZoom}
                  toolMode="select"
                  selectedCells={new Set()}
                  onPanBy={panBy}
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
          justCompleted={justCompleted}
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
