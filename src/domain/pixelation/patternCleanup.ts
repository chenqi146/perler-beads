import type { MappedPixel } from './pixelation';
import { TRANSPARENT_KEY } from './pixelEditingUtils';

function isContentCell(cell: MappedPixel | undefined): boolean {
  return Boolean(cell && !cell.isExternal && cell.key !== TRANSPARENT_KEY);
}

function lumaOfHex(hex: string): number {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return 128;
  const r = parseInt(m[1], 16);
  const g = parseInt(m[2], 16);
  const b = parseInt(m[3], 16);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * 3×3 多数滤波：邻域内某色达到 minMajority 时替换中心格。
 * 跳过透明/外部格；与多数色高对比的中心格（描边）保留。
 */
export function majorityFilter(
  data: MappedPixel[][],
  minMajority = 5,
  preserveContrast = 42,
): MappedPixel[][] {
  const M = data.length;
  const N = data[0]?.length || 0;
  if (M === 0 || N === 0) return data;

  const output = data.map((row) => row.map((cell) => ({ ...cell })));

  for (let y = 0; y < M; y++) {
    for (let x = 0; x < N; x++) {
      const center = data[y][x];
      if (!isContentCell(center)) continue;

      const counts = new Map<string, { count: number; color: string }>();
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const ny = y + dy;
          const nx = x + dx;
          if (ny < 0 || ny >= M || nx < 0 || nx >= N) continue;
          const cell = data[ny][nx];
          if (!isContentCell(cell)) continue;
          const prev = counts.get(cell.key);
          if (prev) prev.count++;
          else counts.set(cell.key, { count: 1, color: cell.color });
        }
      }

      let bestKey = '';
      let bestColor = '';
      let bestN = 0;
      for (const [key, info] of counts) {
        if (info.count > bestN) {
          bestN = info.count;
          bestKey = key;
          bestColor = info.color;
        }
      }
      if (bestN < minMajority || !bestKey || bestKey === center.key) continue;

      const contrast = Math.abs(lumaOfHex(center.color) - lumaOfHex(bestColor));
      if (contrast >= preserveContrast) continue;

      output[y][x] = { key: bestKey, color: bestColor, isExternal: false };
    }
  }
  return output;
}

/**
 * 去掉过小的同色连通块（默认面积 < 2），替换为邻域最多的异色。
 * 高对比邻接（亮度差大）时保留，避免吃掉细描边。
 */
export function removeIsolatedNoise(
  data: MappedPixel[][],
  minComponentSize = 2,
  preserveContrast = 42,
): MappedPixel[][] {
  const M = data.length;
  const N = data[0]?.length || 0;
  if (M === 0 || N === 0 || minComponentSize < 1) return data;

  const output = data.map((row) => row.map((cell) => ({ ...cell })));
  const visited = Array.from({ length: M }, () => Array(N).fill(false));

  const lumaOf = (hex: string): number => lumaOfHex(hex);

  const neighbors4 = (r: number, c: number): Array<[number, number]> => {
    const out: Array<[number, number]> = [];
    if (r > 0) out.push([r - 1, c]);
    if (r + 1 < M) out.push([r + 1, c]);
    if (c > 0) out.push([r, c - 1]);
    if (c + 1 < N) out.push([r, c + 1]);
    return out;
  };

  for (let sr = 0; sr < M; sr++) {
    for (let sc = 0; sc < N; sc++) {
      if (visited[sr][sc]) continue;
      const start = data[sr][sc];
      if (!isContentCell(start)) {
        visited[sr][sc] = true;
        continue;
      }

      const targetKey = start.key;
      const queue: Array<[number, number]> = [[sr, sc]];
      const component: Array<[number, number]> = [];
      visited[sr][sc] = true;

      while (queue.length > 0) {
        const [r, c] = queue.shift()!;
        component.push([r, c]);
        for (const [nr, nc] of neighbors4(r, c)) {
          if (visited[nr][nc]) continue;
          const cell = data[nr][nc];
          if (!isContentCell(cell) || cell.key !== targetKey) continue;
          visited[nr][nc] = true;
          queue.push([nr, nc]);
        }
      }

      if (component.length >= minComponentSize) continue;

      const neighborCount = new Map<string, { count: number; color: string }>();
      let maxContrast = 0;
      const selfLuma = lumaOf(start.color);

      for (const [r, c] of component) {
        for (const [nr, nc] of neighbors4(r, c)) {
          const cell = data[nr][nc];
          if (!isContentCell(cell) || cell.key === targetKey) continue;
          const prev = neighborCount.get(cell.key);
          if (prev) prev.count++;
          else neighborCount.set(cell.key, { count: 1, color: cell.color });
          maxContrast = Math.max(maxContrast, Math.abs(selfLuma - lumaOf(cell.color)));
        }
      }

      if (neighborCount.size === 0) continue;
      if (maxContrast >= preserveContrast) continue;

      let replaceKey = targetKey;
      let replaceColor = start.color;
      let best = -1;
      for (const [key, info] of neighborCount) {
        if (info.count > best) {
          best = info.count;
          replaceKey = key;
          replaceColor = info.color;
        }
      }

      for (const [r, c] of component) {
        output[r][c] = { key: replaceKey, color: replaceColor, isExternal: false };
      }
    }
  }

  return output;
}

/** 小画布友好的默认清理：先多数滤波再去孤点 */
export function cleanupPixelGrid(data: MappedPixel[][]): MappedPixel[][] {
  return removeIsolatedNoise(majorityFilter(data, 5), 2);
}
