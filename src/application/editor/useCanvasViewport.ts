'use client';

import { useCallback, useEffect, type RefObject } from 'react';
import type { MappedPixel } from '../../domain/pixelation';
import { useEditorStore } from './editorStore';
import { useEditorUiStore } from './editorUiStore';

export function measureCanvasPixels(N: number, M: number, zoom: number) {
  const cellSize = Math.max(4, Math.round(16 * zoom));
  const axisSize = Math.max(18, Math.min(36, Math.round(cellSize * 1.4)));
  return {
    cellSize,
    axisSize,
    width: axisSize + N * cellSize,
    height: axisSize + M * cellSize,
  };
}

export type UseCanvasViewportOverrides = {
  /** 拼豆页等不走 editorStore 时传入 */
  gridDimensions?: { N: number; M: number } | null;
  mappedPixelData?: MappedPixel[][] | null;
};

/** 画布适应视口 + 进入图纸时自动 fit */
export function useCanvasViewport(
  viewportRef: RefObject<HTMLDivElement | null>,
  overrides?: UseCanvasViewportOverrides,
) {
  const storeGridDimensions = useEditorStore((s) => s.gridDimensions);
  const storeMappedPixelData = useEditorStore((s) => s.mappedPixelData);
  const gridDimensions = overrides?.gridDimensions !== undefined ? overrides.gridDimensions : storeGridDimensions;
  const mappedPixelData =
    overrides?.mappedPixelData !== undefined ? overrides.mappedPixelData : storeMappedPixelData;
  const setPreviewZoom = useEditorUiStore((s) => s.setPreviewZoom);
  const setCanvasOffset = useEditorUiStore((s) => s.setCanvasOffset);

  const fitCanvasToViewport = useCallback(() => {
    const el = viewportRef.current;
    if (!el || !gridDimensions || gridDimensions.N <= 0 || gridDimensions.M <= 0) return;

    const vw = el.clientWidth;
    const vh = el.clientHeight;
    if (vw < 40 || vh < 40) return;

    const pad = 40;
    const availW = Math.max(40, vw - pad);
    const availH = Math.max(40, vh - pad);
    const { N, M } = gridDimensions;

    let zoom = 0.25;
    for (let z = 3; z >= 0.25; z = Math.round((z - 0.05) * 100) / 100) {
      const { width, height } = measureCanvasPixels(N, M, z);
      if (width <= availW && height <= availH) {
        zoom = z;
        break;
      }
    }

    const { width, height } = measureCanvasPixels(N, M, zoom);
    setPreviewZoom(zoom);
    setCanvasOffset({
      x: Math.round((vw - width) / 2),
      y: Math.round((vh - height) / 2),
    });
  }, [viewportRef, gridDimensions, setPreviewZoom, setCanvasOffset]);

  useEffect(() => {
    if (!mappedPixelData || !gridDimensions || gridDimensions.N <= 0 || gridDimensions.M <= 0) return;
    const el = viewportRef.current;
    if (!el) return;

    let fitted = false;
    const tryFit = () => {
      if (fitted) return;
      if (el.clientWidth < 40 || el.clientHeight < 40) return;
      fitted = true;
      fitCanvasToViewport();
    };

    tryFit();
    const ro = new ResizeObserver(tryFit);
    ro.observe(el);
    const timer = window.setTimeout(tryFit, 120);

    return () => {
      ro.disconnect();
      window.clearTimeout(timer);
    };
  }, [gridDimensions?.N, gridDimensions?.M, mappedPixelData ? 1 : 0, fitCanvasToViewport, viewportRef]);

  return { fitCanvasToViewport, measureCanvasPixels };
}

/** 以视口内某点为锚缩放，保持该点下内容不跳 */
export function applyZoomAtPoint(options: {
  currentZoom: number;
  nextZoom: number;
  offset: { x: number; y: number };
  /** 相对视口左上角的锚点 */
  point: { x: number; y: number };
  setPreviewZoom: (z: number) => void;
  setCanvasOffset: (o: { x: number; y: number }) => void;
}) {
  const { currentZoom, nextZoom, offset, point, setPreviewZoom, setCanvasOffset } = options;
  const clamped = Math.max(0.25, Math.min(3, Math.round(nextZoom * 100) / 100));
  if (currentZoom <= 0 || clamped === currentZoom) {
    setPreviewZoom(clamped);
    return;
  }
  const scale = clamped / currentZoom;
  setPreviewZoom(clamped);
  setCanvasOffset({
    x: Math.round(point.x - (point.x - offset.x) * scale),
    y: Math.round(point.y - (point.y - offset.y) * scale),
  });
}
