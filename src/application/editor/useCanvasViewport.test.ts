import { describe, expect, it, vi } from 'vitest';
import { applyZoomAtPoint, measureCanvasPixels } from './useCanvasViewport';

describe('measureCanvasPixels', () => {
  it('scales grid with zoom', () => {
    const at1 = measureCanvasPixels(10, 8, 1);
    const at2 = measureCanvasPixels(10, 8, 2);
    expect(at2.cellSize).toBeGreaterThan(at1.cellSize);
    expect(at2.width).toBeGreaterThan(at1.width);
    expect(at2.height).toBeGreaterThan(at1.height);
  });
});

describe('applyZoomAtPoint', () => {
  it('clamps zoom between 0.25 and 3', () => {
    const setPreviewZoom = vi.fn();
    const setCanvasOffset = vi.fn();

    applyZoomAtPoint({
      currentZoom: 1,
      nextZoom: 10,
      offset: { x: 0, y: 0 },
      point: { x: 100, y: 100 },
      setPreviewZoom,
      setCanvasOffset,
    });

    expect(setPreviewZoom).toHaveBeenCalledWith(3);
  });

  it('keeps anchor point stable when zooming', () => {
    const setPreviewZoom = vi.fn();
    const setCanvasOffset = vi.fn();
    const offset = { x: 50, y: 40 };
    const point = { x: 120, y: 80 };

    applyZoomAtPoint({
      currentZoom: 1,
      nextZoom: 2,
      offset,
      point,
      setPreviewZoom,
      setCanvasOffset,
    });

    expect(setPreviewZoom).toHaveBeenCalledWith(2);
    expect(setCanvasOffset).toHaveBeenCalledWith({
      x: Math.round(point.x - (point.x - offset.x) * 2),
      y: Math.round(point.y - (point.y - offset.y) * 2),
    });
  });
});
