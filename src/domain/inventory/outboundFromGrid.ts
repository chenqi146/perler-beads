import type { MappedPixel } from '../pixelation';
import { TRANSPARENT_KEY } from '../pixelation/pixelEditingUtils';
import type { OutboundLineInput } from './types';

/** 从像素网格统计出库明细（忽略外部与透明） */
export function buildOutboundLinesFromGrid(grid: MappedPixel[][] | null | undefined): OutboundLineInput[] {
  if (!grid?.length) return [];
  const counts = new Map<string, number>();
  for (const row of grid) {
    for (const cell of row) {
      if (!cell || cell.isExternal || cell.key === TRANSPARENT_KEY) continue;
      const hex = String(cell.color || '').toUpperCase();
      if (!hex.startsWith('#') || hex.length !== 7) continue;
      counts.set(hex, (counts.get(hex) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([hex, quantity]) => ({ hex, quantity }))
    .sort((a, b) => a.hex.localeCompare(b.hex));
}
