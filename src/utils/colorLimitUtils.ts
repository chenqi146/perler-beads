import { MappedPixel, PaletteColor, RgbColor, colorDistance, hexToRgb } from './pixelation';
import { TRANSPARENT_KEY, transparentColorData } from './pixelEditingUtils';

/**
 * 将网格颜色数量压缩到 maxColors 以内：反复把出现最少的颜色合并到最近的高频颜色。
 * maxColors <= 0 表示不限制。
 */
export function limitColorCount(
  data: MappedPixel[][],
  palette: PaletteColor[],
  maxColors: number
): MappedPixel[][] {
  if (maxColors <= 0) return data;

  const keyToRgb = new Map<string, RgbColor>();
  const keyToColor = new Map<string, PaletteColor>();
  palette.forEach((p) => {
    keyToRgb.set(p.key, p.rgb);
    keyToColor.set(p.key, p);
  });

  const result = data.map((row) => row.map((cell) => ({ ...cell })));
  const M = result.length;
  const N = result[0]?.length || 0;

  const countColors = () => {
    const counts: Record<string, number> = {};
    for (let r = 0; r < M; r++) {
      for (let c = 0; c < N; c++) {
        const cell = result[r][c];
        if (!cell || cell.isExternal || cell.key === TRANSPARENT_KEY) continue;
        counts[cell.key] = (counts[cell.key] || 0) + 1;
      }
    }
    return counts;
  };

  let counts = countColors();
  let keys = Object.keys(counts);
  let guard = 0;

  while (keys.length > maxColors && guard < 500) {
    guard++;
    keys.sort((a, b) => counts[a] - counts[b]); // ascending by frequency
    const victim = keys[0];
    const victimRgb = keyToRgb.get(victim) || hexToRgb(victim);
    if (!victimRgb) {
      // 无法找到 RGB，直接丢掉该色到下一个最近的 hex
      break;
    }

    let bestKey = keys[1];
    let bestDist = Infinity;
    for (let i = 1; i < keys.length; i++) {
      const candidate = keys[i];
      const rgb = keyToRgb.get(candidate) || hexToRgb(candidate);
      if (!rgb) continue;
      const dist = colorDistance(victimRgb, rgb);
      if (dist < bestDist) {
        bestDist = dist;
        bestKey = candidate;
      }
    }

    if (!bestKey) break;
    const target = keyToColor.get(bestKey);
    const targetHex = target?.hex || bestKey;

    for (let r = 0; r < M; r++) {
      for (let c = 0; c < N; c++) {
        if (result[r][c].key === victim) {
          result[r][c] = {
            key: bestKey,
            color: targetHex,
            isExternal: false,
          };
        }
      }
    }

    counts = countColors();
    keys = Object.keys(counts);
  }

  return result;
}

/**
 * 从边缘洪水填充去除背景色（默认取边缘出现最多的颜色）。
 * 若 preferNearWhite=true，优先选择接近白色的边缘主色。
 */
export function removeEdgeBackground(
  data: MappedPixel[][],
  preferNearWhite = false
): MappedPixel[][] {
  const M = data.length;
  const N = data[0]?.length || 0;
  if (M === 0 || N === 0) return data;

  const result = data.map((row) => row.map((cell) => ({ ...cell })));
  const borderCounts = new Map<string, { count: number; color: string }>();

  const countBorder = (row: number, col: number) => {
    const cell = result[row]?.[col];
    if (!cell || cell.isExternal || cell.key === TRANSPARENT_KEY) return;
    const prev = borderCounts.get(cell.key);
    if (prev) prev.count++;
    else borderCounts.set(cell.key, { count: 1, color: cell.color });
  };

  for (let col = 0; col < N; col++) {
    countBorder(0, col);
    if (M > 1) countBorder(M - 1, col);
  }
  for (let row = 1; row < M - 1; row++) {
    countBorder(row, 0);
    if (N > 1) countBorder(row, N - 1);
  }

  if (borderCounts.size === 0) return result;

  let targetKey = '';
  let maxScore = -1;
  borderCounts.forEach((info, key) => {
    let score = info.count;
    if (preferNearWhite) {
      const rgb = hexToRgb(info.color);
      if (rgb) {
        const brightness = (rgb.r + rgb.g + rgb.b) / 3;
        // 越白权重越高
        if (brightness >= 230) score *= 3;
        else if (brightness >= 200) score *= 1.5;
      }
    }
    if (score > maxScore) {
      maxScore = score;
      targetKey = key;
    }
  });

  if (!targetKey) return result;

  const visited = Array.from({ length: M }, () => Array(N).fill(false));
  const stack: { row: number; col: number }[] = [];

  const pushIfTarget = (row: number, col: number) => {
    if (row < 0 || row >= M || col < 0 || col >= N || visited[row][col]) return;
    const cell = result[row][col];
    if (!cell || cell.isExternal || cell.key !== targetKey) return;
    visited[row][col] = true;
    stack.push({ row, col });
  };

  for (let col = 0; col < N; col++) {
    pushIfTarget(0, col);
    if (M > 1) pushIfTarget(M - 1, col);
  }
  for (let row = 1; row < M - 1; row++) {
    pushIfTarget(row, 0);
    if (N > 1) pushIfTarget(row, N - 1);
  }

  while (stack.length > 0) {
    const { row, col } = stack.pop()!;
    result[row][col] = { ...transparentColorData };
    pushIfTarget(row - 1, col);
    pushIfTarget(row + 1, col);
    pushIfTarget(row, col - 1);
    pushIfTarget(row, col + 1);
  }

  return result;
}

export function recountColors(data: MappedPixel[][]): {
  counts: { [hex: string]: { count: number; color: string } };
  total: number;
} {
  const counts: { [hex: string]: { count: number; color: string } } = {};
  let total = 0;
  data.flat().forEach((cell) => {
    if (cell && cell.key && !cell.isExternal && cell.key !== TRANSPARENT_KEY) {
      const hex = cell.color.toUpperCase();
      if (!counts[hex]) counts[hex] = { count: 0, color: cell.color };
      counts[hex].count++;
      total++;
    }
  });
  return { counts, total };
}

export type GridBounds = { minRow: number; maxRow: number; minCol: number; maxCol: number };

/** 按矩形裁剪网格（含边界） */
export function cropPixelGrid(
  data: MappedPixel[][],
  bounds: GridBounds
): MappedPixel[][] {
  const { minRow, maxRow, minCol, maxCol } = bounds;
  const cropped: MappedPixel[][] = [];
  for (let r = minRow; r <= maxRow; r++) {
    const row: MappedPixel[] = [];
    for (let c = minCol; c <= maxCol; c++) {
      const cell = data[r]?.[c];
      row.push(cell ? { ...cell } : { key: TRANSPARENT_KEY, color: '#FFFFFF', isExternal: true });
    }
    cropped.push(row);
  }
  return cropped;
}

/** 裁到非外部内容的最小包围盒；若全空则返回 null */
export function getContentBounds(data: MappedPixel[][]): GridBounds | null {
  const M = data.length;
  const N = data[0]?.length || 0;
  let minRow = M;
  let maxRow = -1;
  let minCol = N;
  let maxCol = -1;
  for (let r = 0; r < M; r++) {
    for (let c = 0; c < N; c++) {
      const cell = data[r][c];
      if (cell && !cell.isExternal && cell.key !== TRANSPARENT_KEY) {
        if (r < minRow) minRow = r;
        if (r > maxRow) maxRow = r;
        if (c < minCol) minCol = c;
        if (c > maxCol) maxCol = c;
      }
    }
  }
  if (maxRow < 0) return null;
  return { minRow, maxRow, minCol, maxCol };
}

export function autoCropPixelGrid(data: MappedPixel[][]): {
  data: MappedPixel[][];
  bounds: GridBounds;
} | null {
  const bounds = getContentBounds(data);
  if (!bounds) return null;
  // 已是满幅则无需裁
  if (
    bounds.minRow === 0 &&
    bounds.minCol === 0 &&
    bounds.maxRow === data.length - 1 &&
    bounds.maxCol === (data[0]?.length || 0) - 1
  ) {
    return null;
  }
  return { data: cropPixelGrid(data, bounds), bounds };
}
