import {
  colorDistance,
  findClosestPaletteColor,
  type MappedPixel,
  type PaletteColor,
  type RgbColor,
} from './pixelation';
import { limitColorCount } from './colorLimitUtils';

export type PatternGridSource = 'auto' | 'auto-cropped' | 'manual' | 'manual-cropped';

export type PatternGrid = {
  xLines: number[];
  yLines: number[];
  cols: number;
  rows: number;
  source: 'auto' | 'manual';
};

export type RecognizePatternOptions = {
  palette: PaletteColor[];
  fallbackCols: number;
  fallbackRows: number;
  preferAutoGrid?: boolean;
  /** >0 时强制压到该色数；<=0 则按频率自动估计并合并杂色 */
  maxColors?: number;
};

export type RecognizePatternResult = {
  mappedPixelData: MappedPixel[][];
  gridDimensions: { N: number; M: number };
  gridSource: PatternGridSource;
};

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = clamp(Math.round((sorted.length - 1) * p), 0, sorted.length - 1);
  return sorted[idx];
}

function copyImageData(src: ImageData): ImageData {
  return {
    data: new Uint8ClampedArray(src.data),
    width: src.width,
    height: src.height,
    colorSpace: src.colorSpace ?? 'srgb',
  } as ImageData;
}

/** 识别前限制长边，避免手机原图投影扫全图卡死主线程 */
export function downscaleImageDataForRecognition(
  imgData: ImageData,
  maxEdge = 1600,
): ImageData {
  const maxSide = Math.max(imgData.width, imgData.height);
  if (maxSide <= maxEdge) return imgData;

  const scale = maxEdge / maxSide;
  const w = Math.max(1, Math.round(imgData.width * scale));
  const h = Math.max(1, Math.round(imgData.height * scale));
  const out = new Uint8ClampedArray(w * h * 4);
  const { data, width: sw, height: sh } = imgData;

  for (let y = 0; y < h; y++) {
    const sy = Math.min(sh - 1, Math.floor((y + 0.5) / scale));
    for (let x = 0; x < w; x++) {
      const sx = Math.min(sw - 1, Math.floor((x + 0.5) / scale));
      const si = (sy * sw + sx) * 4;
      const di = (y * w + x) * 4;
      out[di] = data[si];
      out[di + 1] = data[si + 1];
      out[di + 2] = data[si + 2];
      out[di + 3] = data[si + 3];
    }
  }

  return {
    data: out,
    width: w,
    height: h,
    colorSpace: imgData.colorSpace ?? 'srgb',
  } as ImageData;
}

/**
 * 四角估背景色，裁掉大片留白；内容几乎铺满时原样返回。
 */
export function cropImageDataToContent(imgData: ImageData): ImageData {
  const { width, height, data } = imgData;
  const cornerSize = Math.max(2, Math.round(Math.min(width, height) * 0.025));
  const samples: RgbColor[] = [];

  const sampleCorner = (x0: number, y0: number) => {
    for (let y = y0; y < Math.min(height, y0 + cornerSize); y++) {
      for (let x = x0; x < Math.min(width, x0 + cornerSize); x++) {
        const o = (y * width + x) * 4;
        samples.push({ r: data[o], g: data[o + 1], b: data[o + 2] });
      }
    }
  };

  sampleCorner(0, 0);
  sampleCorner(Math.max(0, width - cornerSize), 0);
  sampleCorner(0, Math.max(0, height - cornerSize));
  sampleCorner(Math.max(0, width - cornerSize), Math.max(0, height - cornerSize));

  const bg: RgbColor = {
    r: median(samples.map((p) => p.r)),
    g: median(samples.map((p) => p.g)),
    b: median(samples.map((p) => p.b)),
  };

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  const threshold = 26;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      if (data[o + 3] < 128) continue;
      const dr = data[o] - bg.r;
      const dg = data[o + 1] - bg.g;
      const db = data[o + 2] - bg.b;
      if (Math.sqrt(dr * dr + dg * dg + db * db) > threshold) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (maxX < minX || maxY < minY) return imgData;

  const margin = Math.round(Math.min(width, height) * 0.01);
  minX = clamp(minX - margin, 0, width - 1);
  minY = clamp(minY - margin, 0, height - 1);
  maxX = clamp(maxX + margin, 0, width - 1);
  maxY = clamp(maxY + margin, 0, height - 1);

  const cropW = maxX - minX + 1;
  const cropH = maxY - minY + 1;
  if (cropW > width * 0.94 && cropH > height * 0.94) return imgData;

  const cropped = new Uint8ClampedArray(cropW * cropH * 4);
  for (let y = 0; y < cropH; y++) {
    const src = ((minY + y) * width + minX) * 4;
    cropped.set(data.subarray(src, src + cropW * 4), y * cropW * 4);
  }

  return {
    data: cropped,
    width: cropW,
    height: cropH,
    colorSpace: imgData.colorSpace ?? 'srgb',
  } as ImageData;
}

/** 按像素矩形裁剪（右下为开区间，与网格线坐标一致） */
export function cropImageDataToRect(
  imgData: ImageData,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): ImageData {
  const left = clamp(Math.floor(Math.min(x0, x1)), 0, imgData.width - 1);
  const top = clamp(Math.floor(Math.min(y0, y1)), 0, imgData.height - 1);
  const right = clamp(Math.ceil(Math.max(x0, x1)), left + 1, imgData.width);
  const bottom = clamp(Math.ceil(Math.max(y0, y1)), top + 1, imgData.height);
  const cropW = right - left;
  const cropH = bottom - top;
  const { data, width } = imgData;
  const cropped = new Uint8ClampedArray(cropW * cropH * 4);
  for (let y = 0; y < cropH; y++) {
    const src = ((top + y) * width + left) * 4;
    cropped.set(data.subarray(src, src + cropW * 4), y * cropW * 4);
  }
  return {
    data: cropped,
    width: cropW,
    height: cropH,
    colorSpace: imgData.colorSpace ?? 'srgb',
  } as ImageData;
}

/** 沿单轴投影：暗中性色 + 局部灰度跳变，用于找网格线 */
export function buildAxisLineScores(imgData: ImageData, axis: 'x' | 'y'): Float32Array {
  const { width, height, data } = imgData;
  const len = axis === 'x' ? width : height;
  const cross = axis === 'x' ? height : width;
  const scores = new Float32Array(len);

  for (let p = 1; p < len - 1; p++) {
    let score = 0;
    for (let q = 0; q < cross; q++) {
      const x = axis === 'x' ? p : q;
      const y = axis === 'x' ? q : p;
      const o = (y * width + x) * 4;
      const r = data[o];
      const g = data[o + 1];
      const b = data[o + 2];
      const maxC = Math.max(r, g, b);
      const minC = Math.min(r, g, b);
      const neutralDark = maxC < 215 && maxC - minC < 90;

      const before = axis === 'x' ? o - 4 : o - width * 4;
      const after = axis === 'x' ? o + 4 : o + width * 4;
      const gray0 = 0.299 * data[before] + 0.587 * data[before + 1] + 0.114 * data[before + 2];
      const gray1 = 0.299 * r + 0.587 * g + 0.114 * b;
      const gray2 = 0.299 * data[after] + 0.587 * data[after + 1] + 0.114 * data[after + 2];
      const edge = Math.abs(gray1 - gray0) + Math.abs(gray2 - gray1);

      if (neutralDark) score += 0.85;
      if (edge > 20) score += 0.55;
    }
    scores[p] = score;
  }

  return scores;
}

type PeakRun = { pos: number; width: number; score: number };

function weightRun(run: { pos: number; score: number }[]): PeakRun {
  const total = run.reduce((s, x) => s + x.score, 0) || 1;
  return {
    pos: Math.round(run.reduce((s, x) => s + x.pos * x.score, 0) / total),
    width: run[run.length - 1].pos - run[0].pos + 1,
    score: total,
  };
}

function groupRuns(items: { pos: number; score: number }[]): PeakRun[] {
  const runs: PeakRun[] = [];
  let current: { pos: number; score: number }[] = [];
  for (const item of items) {
    if (!current.length || item.pos <= current[current.length - 1].pos + 1) {
      current.push(item);
    } else {
      runs.push(weightRun(current));
      current = [item];
    }
  }
  if (current.length) runs.push(weightRun(current));
  return runs;
}

export function extractLinePeaks(scores: Float32Array): PeakRun[] {
  const values = Array.from(scores);
  const maxScore = Math.max(...values, 0);
  if (maxScore <= 0) return [];
  const threshold = Math.max(percentile(values, 0.88), maxScore * 0.18);
  const hits: { pos: number; score: number }[] = [];
  for (let i = 0; i < scores.length; i++) {
    if (scores[i] >= threshold) hits.push({ pos: i, score: scores[i] });
  }
  return groupRuns(hits)
    .filter((r) => r.width <= 10)
    .sort((a, b) => a.pos - b.pos);
}

export function areLinesStable(lines: number[]): boolean {
  if (lines.length < 3) return false;
  const diffs: number[] = [];
  for (let i = 1; i < lines.length; i++) diffs.push(lines[i] - lines[i - 1]);
  const step = median(diffs);
  if (step < 6) return false;
  const tolerance = Math.max(3, step * 0.22);
  return diffs.filter((d) => Math.abs(d - step) <= tolerance).length / diffs.length >= 0.82;
}

function findPeakNear(
  peaks: PeakRun[],
  expected: number,
  tolerance: number,
): PeakRun | null {
  let best: PeakRun | null = null;
  let bestDist = Infinity;
  for (const peak of peaks) {
    const d = Math.abs(peak.pos - expected);
    if (d <= tolerance && d < bestDist) {
      best = peak;
      bestDist = d;
    }
  }
  return best;
}

/** 从投影分推断等距网格线位置 */
export function inferGridLines(scores: Float32Array): number[] | null {
  const peaks = extractLinePeaks(scores);
  if (peaks.length < 3) return null;

  const diffs: number[] = [];
  for (let i = 0; i < peaks.length; i++) {
    for (let j = i + 1; j < peaks.length; j++) {
      const d = peaks[j].pos - peaks[i].pos;
      if (d >= 6 && d <= 80) diffs.push(Math.round(d));
      if (d > 80) break;
    }
  }
  if (!diffs.length) return null;

  const buckets = new Map<number, number>();
  for (const d of diffs) buckets.set(d, (buckets.get(d) || 0) + 1);
  const stepCandidates = [...buckets.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([step]) => step);

  let best: { lines: number[]; score: number } | null = null;
  for (const step of stepCandidates) {
    const tolerance = Math.max(3, step * 0.22);
    for (const start of peaks) {
      const lines: number[] = [];
      let expected = start.pos;
      while (expected >= -tolerance) expected -= step;
      expected += step;
      while (expected <= scores.length - 1 + tolerance) {
        const peak = findPeakNear(peaks, expected, tolerance);
        lines.push(peak?.pos ?? Math.round(expected));
        expected += step;
      }
      const unique = [...new Set(lines.filter((v) => v >= 0 && v < scores.length))].sort(
        (a, b) => a - b,
      );
      if (unique.length < 4 || !areLinesStable(unique)) continue;
      const strength = unique.reduce((s, p) => s + (scores[p] || 0), 0);
      const score = unique.length * 10000 + strength;
      if (!best || score > best.score) best = { lines: unique, score };
    }
  }

  return best?.lines ?? null;
}

export function buildEvenGrid(imgData: ImageData, cols: number, rows: number): PatternGrid {
  const w = Math.max(1, Math.round(cols));
  const h = Math.max(1, Math.round(rows));
  const xLines: number[] = [];
  const yLines: number[] = [];
  for (let x = 0; x <= w; x++) {
    xLines.push(clamp(Math.round((imgData.width * x) / w), 0, imgData.width));
  }
  for (let y = 0; y <= h; y++) {
    yLines.push(clamp(Math.round((imgData.height * y) / h), 0, imgData.height));
  }
  xLines[w] = imgData.width;
  yLines[h] = imgData.height;
  return { xLines, yLines, cols: w, rows: h, source: 'manual' };
}

export function detectGrid(imgData: ImageData): PatternGrid | null {
  const xLines = inferGridLines(buildAxisLineScores(imgData, 'x'));
  const yLines = inferGridLines(buildAxisLineScores(imgData, 'y'));
  if (!xLines || !yLines) return null;
  if (!areLinesStable(xLines) || !areLinesStable(yLines)) return null;
  const cols = xLines.length - 1;
  const rows = yLines.length - 1;
  if (cols < 2 || rows < 2 || cols > 220 || rows > 220) return null;
  return { xLines, yLines, cols, rows, source: 'auto' };
}

function lumaOf(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * 采样格心填充色：忽略网格线、色号文字与抗锯齿（带色号图纸常见把 11 色炸成几十色）。
 */
export function sampleCellRgb(
  imgData: ImageData,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): RgbColor | null {
  const { width, data } = imgData;
  const cellW = Math.max(1, x1 - x0);
  const cellH = Math.max(1, y1 - y0);
  // 更大内缩：躲开灰/红网格线
  const insetX = Math.max(1, Math.floor(cellW * 0.22));
  const insetY = Math.max(1, Math.floor(cellH * 0.22));
  const left = x0 + insetX;
  const top = y0 + insetY;
  const right = Math.max(left + 1, x1 - insetX);
  const bottom = Math.max(top + 1, y1 - insetY);

  const pixels: RgbColor[] = [];
  const lumas: number[] = [];
  for (let y = top; y < bottom; y++) {
    for (let x = left; x < right; x++) {
      const o = (y * width + x) * 4;
      if (data[o + 3] < 128) continue;
      const r = data[o];
      const g = data[o + 1];
      const b = data[o + 2];
      pixels.push({ r, g, b });
      lumas.push(lumaOf(r, g, b));
    }
  }
  if (!pixels.length) return null;

  const midLuma = median(lumas);
  // 丢掉相对中位亮度差过大的像素：黑/白字迹、抗锯齿边
  const inkTol = Math.max(28, midLuma < 80 || midLuma > 200 ? 40 : 36);
  const fill = pixels.filter((_, i) => {
    const luma = lumas[i];
    if (Math.abs(luma - midLuma) > inkTol) return false;
    // 浅色底 + 深色号：额外丢掉明显更暗的字迹，避免棕/米色被拉灰
    if (midLuma >= 150 && luma < midLuma - 20) return false;
    return true;
  });
  // 网格线+浅底双峰时，中位亮度落在中间，inkTol 会滤空；优先浅色簇
  let pool = fill.length >= Math.max(4, pixels.length * 0.28) ? fill : pixels;
  if (pool === pixels && pixels.length >= 8) {
    const sorted = [...lumas].sort((a, b) => a - b);
    const p20 = sorted[Math.floor(sorted.length * 0.2)]!;
    const p80 = sorted[Math.floor(sorted.length * 0.8)]!;
    if (p80 - p20 > 70) {
      const cut = (p20 + p80) / 2;
      const light = pixels.filter((_, i) => lumas[i] >= cut);
      if (light.length >= pixels.length * 0.35) {
        pool = light;
      }
    }
  }

  // 5-bit 分箱足够抗 JPEG，又不会把邻近色号糊死
  const bins = new Map<number, { w: number; sumR: number; sumG: number; sumB: number }>();
  let bestKey = -1;
  let bestW = -1;

  for (const p of pool) {
    // 越接近中位亮度权重越高，进一步压制字迹抗锯齿
    const dl = Math.abs(lumaOf(p.r, p.g, p.b) - midLuma);
    const w = 1 + Math.max(0, 1 - dl / inkTol);
    const key = ((p.r >> 3) << 10) | ((p.g >> 3) << 5) | (p.b >> 3);
    const bin = bins.get(key);
    if (bin) {
      bin.w += w;
      bin.sumR += p.r * w;
      bin.sumG += p.g * w;
      bin.sumB += p.b * w;
      if (bin.w > bestW) {
        bestW = bin.w;
        bestKey = key;
      }
    } else {
      bins.set(key, { w, sumR: p.r * w, sumG: p.g * w, sumB: p.b * w });
      if (w > bestW) {
        bestW = w;
        bestKey = key;
      }
    }
  }

  const best = bins.get(bestKey);
  if (!best || best.w <= 0) {
    return pool[Math.floor(pool.length / 2)];
  }

  return {
    r: Math.round(best.sumR / best.w),
    g: Math.round(best.sumG / best.w),
    b: Math.round(best.sumB / best.w),
  };
}

type RgbCluster = {
  id: number;
  count: number;
  sumR: number;
  sumG: number;
  sumB: number;
};

function clusterMean(c: RgbCluster): RgbColor {
  return {
    r: Math.round(c.sumR / c.count),
    g: Math.round(c.sumG / c.count),
    b: Math.round(c.sumB / c.count),
  };
}

/** 把感知相近的采样簇合并，抑制 JPEG/字迹导致的色号爆炸 */
export function mergeSimilarRgbClusters(
  clusters: RgbCluster[],
  mergeDeltaE = 9,
): { clusters: RgbCluster[]; remap: Map<number, number> } {
  const live = clusters.map((c) => ({ ...c }));
  const remap = new Map<number, number>();
  for (const c of live) remap.set(c.id, c.id);

  let changed = true;
  let guard = 0;
  while (changed && guard < 200) {
    guard++;
    changed = false;
    live.sort((a, b) => b.count - a.count);
    for (let i = 0; i < live.length; i++) {
      for (let j = i + 1; j < live.length; j++) {
        const a = live[i];
        const b = live[j];
        if (colorDistance(clusterMean(a), clusterMean(b)) > mergeDeltaE) continue;
        a.count += b.count;
        a.sumR += b.sumR;
        a.sumG += b.sumG;
        a.sumB += b.sumB;
        for (const [from, to] of remap) {
          if (to === b.id) remap.set(from, a.id);
        }
        remap.set(b.id, a.id);
        live.splice(j, 1);
        changed = true;
        break;
      }
      if (changed) break;
    }
  }

  return { clusters: live, remap };
}

/** 按频率自动估计「真实用色」上限：大块色之后的长尾视为杂色 */
export function estimateRecognizeColorBudget(counts: number[]): number {
  if (!counts.length) return 0;
  const sorted = [...counts].sort((a, b) => b - a);
  const total = sorted.reduce((s, n) => s + n, 0) || 1;
  let cum = 0;
  for (let i = 0; i < sorted.length; i++) {
    cum += sorted[i];
    const next = sorted[i + 1] ?? 0;
    const share = cum / total;
    // 已覆盖绝大部分，且下一位占比极低 → 截断长尾杂色（保留少量色如 G2=16）
    if (share >= 0.985 && next / total < 0.0015) return i + 1;
    if (next > 0 && sorted[i] >= next * 10 && share >= 0.94 && next / total < 0.0015) return i + 1;
    if (next > 0 && next <= 4 && share >= 0.96) return i + 1;
  }
  return Math.min(sorted.length, 48);
}

function samplesToMappedPixels(
  samples: (RgbColor | null)[],
  cols: number,
  rows: number,
  palette: PaletteColor[],
  maxColors = 0,
): MappedPixel[][] {
  type Bin = RgbCluster;
  const bins = new Map<number, Bin>();
  const sampleBinIds: number[] = [];
  let nextId = 1;

  for (const sample of samples) {
    if (!sample) {
      sampleBinIds.push(-1);
      continue;
    }
    const key = ((sample.r >> 3) << 10) | ((sample.g >> 3) << 5) | (sample.b >> 3);
    let bin = bins.get(key);
    if (!bin) {
      bin = { id: nextId++, count: 0, sumR: 0, sumG: 0, sumB: 0 };
      bins.set(key, bin);
    }
    bin.count += 1;
    bin.sumR += sample.r;
    bin.sumG += sample.g;
    bin.sumB += sample.b;
    sampleBinIds.push(bin.id);
  }

  // 限色较宽或未限时少并簇，避免相近棕/米色被糊成一色
  const mergeDeltaE = maxColors > 0 && maxColors <= 12 ? 6.5 : 8;
  const { clusters, remap } = mergeSimilarRgbClusters([...bins.values()], mergeDeltaE);
  const byId = new Map(clusters.map((c) => [c.id, c]));
  const mappedByCluster = new Map<number, PaletteColor>();
  for (const c of clusters) {
    mappedByCluster.set(c.id, findClosestPaletteColor(clusterMean(c), palette));
  }

  const grid: MappedPixel[][] = [];
  for (let y = 0; y < rows; y++) {
    const row: MappedPixel[] = [];
    for (let x = 0; x < cols; x++) {
      const binId = sampleBinIds[y * cols + x];
      if (binId < 0) {
        row.push({ key: 'ERR', color: '#000000', isExternal: false });
        continue;
      }
      const root = remap.get(binId) ?? binId;
      const mapped = mappedByCluster.get(root) ?? findClosestPaletteColor(clusterMean(byId.get(root)!), palette);
      row.push({ key: mapped.key, color: mapped.hex, isExternal: false });
    }
    grid.push(row);
  }

  // 映射后仍可能因字迹落到邻近色号：按频率压色
  const keyCounts = new Map<string, number>();
  for (const row of grid) {
    for (const cell of row) {
      if (cell.key === 'ERR') continue;
      keyCounts.set(cell.key, (keyCounts.get(cell.key) || 0) + 1);
    }
  }
  const budget =
    maxColors > 0 ? maxColors : estimateRecognizeColorBudget([...keyCounts.values()]);
  if (budget > 0 && keyCounts.size > budget) {
    return limitColorCount(grid, palette, budget);
  }
  return grid;
}

/**
 * 从已解码的 ImageData 识别拼豆图纸。
 * 优先自动网格；失败则按 fallback 尺寸均分采样。
 */
export function recognizePatternFromImageData(
  imgData: ImageData,
  opts: RecognizePatternOptions,
): RecognizePatternResult {
  if (!opts.palette.length) {
    throw new Error('当前色板为空，无法识别图纸颜色。');
  }

  const fallbackCols = Math.max(2, Math.round(opts.fallbackCols));
  const fallbackRows = Math.max(2, Math.round(opts.fallbackRows));
  const preferAuto = opts.preferAutoGrid === true;

  // 先缩再检：网格线在缩略图上仍可检出，手机 12MP 原图否则易卡死
  const scaled = downscaleImageDataForRecognition(imgData);
  const cropped = cropImageDataToContent(scaled);
  const didCrop =
    cropped !== scaled && (cropped.width !== scaled.width || cropped.height !== scaled.height);

  const hintOnScaled = detectGrid(scaled);
  const hintOnCropped = !hintOnScaled && didCrop ? detectGrid(cropped) : null;
  const hintGrid = hintOnScaled ?? hintOnCropped;
  const hintBase = hintOnScaled ? scaled : cropped;

  let workData: ImageData = cropped;
  let grid: PatternGrid;
  let gridSource: PatternGridSource;

  if (preferAuto && hintGrid) {
    workData = hintBase;
    grid = hintGrid;
    gridSource = hintOnScaled ? 'auto' : 'auto-cropped';
  } else if (hintGrid) {
    // 手动尺寸：用检出的网格外框对齐图纸区，再严格按用户设定均分（不再用「接近」的自动行列数覆盖）
    const x0 = hintGrid.xLines[0];
    const y0 = hintGrid.yLines[0];
    const x1 = hintGrid.xLines[hintGrid.xLines.length - 1];
    const y1 = hintGrid.yLines[hintGrid.yLines.length - 1];
    const region = cropImageDataToRect(hintBase, x0, y0, x1, y1);
    workData = region;
    grid = buildEvenGrid(region, fallbackCols, fallbackRows);
    gridSource = 'manual-cropped';
  } else {
    workData = cropped;
    grid = buildEvenGrid(cropped, fallbackCols, fallbackRows);
    gridSource = didCrop ? 'manual-cropped' : 'manual';
  }

  const samples: (RgbColor | null)[] = [];
  for (let y = 0; y < grid.rows; y++) {
    for (let x = 0; x < grid.cols; x++) {
      samples.push(
        sampleCellRgb(
          workData,
          grid.xLines[x],
          grid.yLines[y],
          grid.xLines[x + 1],
          grid.yLines[y + 1],
        ),
      );
    }
  }

  const mappedPixelData = samplesToMappedPixels(
    samples,
    grid.cols,
    grid.rows,
    opts.palette,
    opts.maxColors ?? 0,
  );

  return {
    mappedPixelData,
    gridDimensions: { N: grid.cols, M: grid.rows },
    gridSource,
  };
}

/** 浏览器环境：从 data URL / blob URL 加载 ImageData */
export async function loadImageDataFromSrc(src: string): Promise<ImageData> {
  if (typeof document === 'undefined') {
    throw new Error('loadImageDataFromSrc 仅可在浏览器中使用。');
  }

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('图片读取失败。'));
    el.src = src;
  });

  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('无法读取图片像素。');
  ctx.drawImage(img, 0, 0);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

export async function recognizePatternFromSrc(
  src: string,
  opts: RecognizePatternOptions,
): Promise<RecognizePatternResult> {
  const imgData = await loadImageDataFromSrc(src);
  return recognizePatternFromImageData(imgData, opts);
}

/** 测试/工具：浅拷贝 ImageData */
export function cloneImageData(imgData: ImageData): ImageData {
  return copyImageData(imgData);
}
