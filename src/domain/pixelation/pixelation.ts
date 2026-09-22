import { transparentColorData } from './pixelEditingUtils';
import {
  extractStrokeMask,
  sampleStrokeCellColor,
} from './strokeExtract';
import { applyFloydSteinbergDither } from './dithering';

// 定义像素化模式
export enum PixelationMode {
  Dominant = 'dominant', // 卡通模式（主色）
  Average = 'average', // 真实模式（线性平均）
  EdgeAware = 'edge-aware', // 清晰模式（保轮廓，小画布更友好）
}

// 定义色号系统类型
export type ColorSystem = 'MARD' | 'COCO' | '漫漫' | '盼盼' | '咪小窝';

// --- 必要的类型定义 ---
export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

interface OklabColor {
  l: number;
  a: number;
  b: number;
}

interface LabColor {
  l: number;
  a: number;
  b: number;
}

export interface PaletteColor {
  key: string;
  hex: string;
  rgb: RgbColor;
}

export interface MappedPixel {
  key: string;
  color: string;
  isExternal?: boolean;
}

// --- 辅助函数 ---

// 转换 Hex 到 RGB
export function hexToRgb(hex: string): RgbColor | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

function srgbChannelToLinear(channel: number): number {
  const normalized = channel / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : Math.pow((normalized + 0.055) / 1.055, 2.4);
}

function linearChannelToSrgb(value: number): number {
  const s =
    value <= 0.0031308
      ? value * 12.92
      : 1.055 * Math.pow(value, 1 / 2.4) - 0.055;
  return Math.round(Math.max(0, Math.min(255, s * 255)));
}

/** 6-bit/通道量化键：相近 RGB 归入同一桶，抗噪且比精确计次更稳 */
function quantizedColorKey(r: number, g: number, b: number): number {
  return ((r >> 2) << 12) | ((g >> 2) << 6) | (b >> 2);
}

function rgbToOklab(rgb: RgbColor): OklabColor {
  const r = srgbChannelToLinear(rgb.r);
  const g = srgbChannelToLinear(rgb.g);
  const b = srgbChannelToLinear(rgb.b);

  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;

  const lRoot = Math.cbrt(l);
  const mRoot = Math.cbrt(m);
  const sRoot = Math.cbrt(s);

  return {
    l: 0.2104542553 * lRoot + 0.7936177850 * mRoot - 0.0040720468 * sRoot,
    a: 1.9779984951 * lRoot - 2.4285922050 * mRoot + 0.4505937099 * sRoot,
    b: 0.0259040371 * lRoot + 0.7827717662 * mRoot - 0.8086757660 * sRoot,
  };
}

/** sRGB → CIELAB (D65)，供 CIEDE2000 使用 */
function rgbToLab(rgb: RgbColor): LabColor {
  const r = srgbChannelToLinear(rgb.r);
  const g = srgbChannelToLinear(rgb.g);
  const b = srgbChannelToLinear(rgb.b);

  // sRGB D65 → XYZ
  let x = r * 0.4124564 + g * 0.3575761 + b * 0.1804375;
  let y = r * 0.2126729 + g * 0.7151522 + b * 0.0721750;
  let z = r * 0.0193339 + g * 0.1191920 + b * 0.9503041;

  // 相对 D65 白点归一化
  x /= 0.95047;
  y /= 1.0;
  z /= 1.08883;

  const f = (t: number) =>
    t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;

  const fx = f(x);
  const fy = f(y);
  const fz = f(z);

  return {
    l: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  };
}

/** CIEDE2000 感知色差（ΔE00），数值越小越接近人眼观感 */
function ciede2000(lab1: LabColor, lab2: LabColor): number {
  const { l: L1, a: a1, b: b1 } = lab1;
  const { l: L2, a: a2, b: b2 } = lab2;
  const kL = 1;
  const kC = 1;
  const kH = 1;

  const C1 = Math.sqrt(a1 * a1 + b1 * b1);
  const C2 = Math.sqrt(a2 * a2 + b2 * b2);
  const Cbar = (C1 + C2) / 2;

  const Cbar7 = Cbar ** 7;
  const G = 0.5 * (1 - Math.sqrt(Cbar7 / (Cbar7 + 25 ** 7)));

  const a1p = (1 + G) * a1;
  const a2p = (1 + G) * a2;
  const C1p = Math.sqrt(a1p * a1p + b1 * b1);
  const C2p = Math.sqrt(a2p * a2p + b2 * b2);

  const h = (ap: number, bp: number) => {
    if (ap === 0 && bp === 0) return 0;
    const hp = Math.atan2(bp, ap) * (180 / Math.PI);
    return hp >= 0 ? hp : hp + 360;
  };
  const h1p = h(a1p, b1);
  const h2p = h(a2p, b2);

  const dLp = L2 - L1;
  const dCp = C2p - C1p;

  let dhp = 0;
  if (C1p * C2p !== 0) {
    const diff = h2p - h1p;
    if (Math.abs(diff) <= 180) dhp = diff;
    else if (diff > 180) dhp = diff - 360;
    else dhp = diff + 360;
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp * Math.PI) / 180 / 2);

  const Lbar = (L1 + L2) / 2;
  const Cpbar = (C1p + C2p) / 2;

  let hpbar = 0;
  if (C1p * C2p === 0) {
    hpbar = h1p + h2p;
  } else {
    const sum = h1p + h2p;
    const diff = Math.abs(h1p - h2p);
    if (diff <= 180) hpbar = sum / 2;
    else if (sum < 360) hpbar = (sum + 360) / 2;
    else hpbar = (sum - 360) / 2;
  }

  const T =
    1 -
    0.17 * Math.cos(((hpbar - 30) * Math.PI) / 180) +
    0.24 * Math.cos((2 * hpbar * Math.PI) / 180) +
    0.32 * Math.cos(((3 * hpbar + 6) * Math.PI) / 180) -
    0.2 * Math.cos(((4 * hpbar - 63) * Math.PI) / 180);

  const dTheta = 30 * Math.exp(-(((hpbar - 275) / 25) ** 2));
  const Cpbar7 = Cpbar ** 7;
  const RC = 2 * Math.sqrt(Cpbar7 / (Cpbar7 + 25 ** 7));
  const SL = 1 + (0.015 * (Lbar - 50) ** 2) / Math.sqrt(20 + (Lbar - 50) ** 2);
  const SC = 1 + 0.045 * Cpbar;
  const SH = 1 + 0.015 * Cpbar * T;
  const RT = -Math.sin((2 * dTheta * Math.PI) / 180) * RC;

  const dL = dLp / (kL * SL);
  const dC = dCp / (kC * SC);
  const dH = dHp / (kH * SH);

  return Math.sqrt(dL * dL + dC * dC + dH * dH + RT * dC * dH);
}

const labCache = new Map<string, LabColor>();

function getLabColor(rgb: RgbColor): LabColor {
  const cacheKey = `${rgb.r},${rgb.g},${rgb.b}`;
  const cached = labCache.get(cacheKey);
  if (cached) return cached;
  const lab = rgbToLab(rgb);
  labCache.set(cacheKey, lab);
  return lab;
}

/**
 * 感知色差距离（CIEDE2000 ΔE00）。
 * 约 <2 人眼难辨；2–10 可察觉；>15 明显偏色。
 * 颜色合并滑块仍用同一数值尺度（建议保持默认 0，谨慎上调）。
 */
export function colorDistance(rgb1: RgbColor, rgb2: RgbColor): number {
  return ciede2000(getLabColor(rgb1), getLabColor(rgb2));
}

/** 兼容旧逻辑：Oklab 欧氏距离（×100），仅供对照/调试 */
export function colorDistanceOklab(rgb1: RgbColor, rgb2: RgbColor): number {
  const o1 = rgbToOklab(rgb1);
  const o2 = rgbToOklab(rgb2);
  const dl = o1.l - o2.l;
  const da = o1.a - o2.a;
  const db = o1.b - o2.b;
  return Math.sqrt(dl * dl + da * da + db * db) * 100;
}

// 查找最接近的颜色（CIEDE2000 最小者）
export function findClosestPaletteColor(
  targetRgb: RgbColor,
  palette: PaletteColor[]
): PaletteColor {
  if (!palette || palette.length === 0) {
      console.error("findClosestPaletteColor: Palette is empty or invalid!");
      // 提供一个健壮的回退
      return { key: 'ERR', hex: '#000000', rgb: { r: 0, g: 0, b: 0 } };
  }

  let minDistance = Infinity;
  let closestColor = palette[0];

  for (const paletteColor of palette) {
    const distance = colorDistance(targetRgb, paletteColor.rgb);
    if (distance < minDistance) {
      minDistance = distance;
      closestColor = paletteColor;
    }
    if (distance === 0) break; // 完全匹配，提前退出
  }
  return closestColor;
}


// --- 核心像素化计算逻辑 ---

function luminanceRgb(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function addToQuantizedBin(
  freq: Map<number, { count: number; sumR: number; sumG: number; sumB: number }>,
  r: number,
  g: number,
  b: number,
  weight = 1,
): void {
  const key = quantizedColorKey(r, g, b);
  const entry = freq.get(key);
  if (entry) {
    entry.count += weight;
    entry.sumR += r * weight;
    entry.sumG += g * weight;
    entry.sumB += b * weight;
  } else {
    freq.set(key, {
      count: weight,
      sumR: r * weight,
      sumG: g * weight,
      sumB: b * weight,
    });
  }
}

function bestBinColor(
  freq: Map<number, { count: number; sumR: number; sumG: number; sumB: number }>,
): RgbColor | null {
  let bestKey = -1;
  let bestCount = 0;
  for (const [key, entry] of freq) {
    if (entry.count > bestCount) {
      bestCount = entry.count;
      bestKey = key;
    }
  }
  if (bestKey < 0) return null;
  const best = freq.get(bestKey)!;
  return {
    r: Math.round(best.sumR / best.count),
    g: Math.round(best.sumG / best.count),
    b: Math.round(best.sumB / best.count),
  };
}

/**
 * 小画布时对源图做轻度对比度 + 锐化，减轻降采样糊掉轮廓。
 * 当每格覆盖的原图像素较少时跳过。
 */
export function enhanceImageDataForSmallGrid(
  imageData: ImageData,
  gridW: number,
  gridH: number,
): ImageData {
  const cellW = imageData.width / Math.max(1, gridW);
  const cellH = imageData.height / Math.max(1, gridH);
  if (cellW * cellH < 36) return imageData;

  const w = imageData.width;
  const h = imageData.height;
  const src = imageData.data;
  const copy = new Uint8ClampedArray(src);
  const out = new Uint8ClampedArray(src.length);

  const contrast = 1.18; // ~+18%
  const sharpen = 0.22;
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const a = copy[i + 3];
      if (a < 128) {
        out[i] = copy[i];
        out[i + 1] = copy[i + 1];
        out[i + 2] = copy[i + 2];
        out[i + 3] = a;
        continue;
      }

      let r = copy[i];
      let g = copy[i + 1];
      let b = copy[i + 2];

      // contrast around mid-gray
      r = (r - 128) * contrast + 128;
      g = (g - 128) * contrast + 128;
      b = (b - 128) * contrast + 128;

      if (y > 0 && y < h - 1 && x > 0 && x < w - 1) {
        const t = i - w * 4;
        const bt = i + w * 4;
        for (let c = 0; c < 3; c++) {
          const center = c === 0 ? r : c === 1 ? g : b;
          const lap =
            4 * copy[i + c] - copy[t + c] - copy[bt + c] - copy[i - 4 + c] - copy[i + 4 + c];
          const sharpened = center + sharpen * lap;
          if (c === 0) r = sharpened;
          else if (c === 1) g = sharpened;
          else b = sharpened;
        }
      }

      out[i] = clamp(r);
      out[i + 1] = clamp(g);
      out[i + 2] = clamp(b);
      out[i + 3] = a;
    }
  }

  return { data: out, width: w, height: h, colorSpace: imageData.colorSpace } as ImageData;
}

/**
 * 计算图像指定区域的代表色（根据所选模式）
 * - Average：线性 RGB 面积平均后再编码回 sRGB（减轻灰边）
 * - Dominant：6-bit 量化直方图主色，桶内再平均（抗噪）
 * - EdgeAware：中心加权填充 + 高对比边缘优先（小画布保轮廓）
 */
export function calculateCellRepresentativeColor(
  imageData: ImageData,
  startX: number,
  startY: number,
  width: number,
  height: number,
  mode: PixelationMode,
): RgbColor | null {
  const data = imageData.data;
  const imgWidth = imageData.width;
  const imgHeight = imageData.height;
  const endX = startX + width;
  const endY = startY + height;

  if (mode === PixelationMode.EdgeAware) {
    return calculateEdgeAwareCellColor(data, imgWidth, imgHeight, startX, startY, endX, endY);
  }

  let linR = 0;
  let linG = 0;
  let linB = 0;
  let pixelCount = 0;
  const freq = new Map<number, { count: number; sumR: number; sumG: number; sumB: number }>();

  for (let y = startY; y < endY; y++) {
    for (let x = startX; x < endX; x++) {
      const index = (y * imgWidth + x) * 4;
      if (data[index + 3] < 128) continue;

      const r = data[index];
      const g = data[index + 1];
      const b = data[index + 2];
      pixelCount++;

      if (mode === PixelationMode.Average) {
        linR += srgbChannelToLinear(r);
        linG += srgbChannelToLinear(g);
        linB += srgbChannelToLinear(b);
      } else {
        addToQuantizedBin(freq, r, g, b);
      }
    }
  }

  if (pixelCount === 0) return null;

  if (mode === PixelationMode.Average) {
    return {
      r: linearChannelToSrgb(linR / pixelCount),
      g: linearChannelToSrgb(linG / pixelCount),
      b: linearChannelToSrgb(linB / pixelCount),
    };
  }

  return bestBinColor(freq);
}

function calculateEdgeAwareCellColor(
  data: Uint8ClampedArray,
  imgWidth: number,
  imgHeight: number,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
): RgbColor | null {
  // 对插画细线更敏感：更低的边缘占比门槛
  const edgeMin = 0.18;
  const edgeRatioMin = 0.025;
  const edgeShareMin = 0.35;
  const edgeLumaDelta = 12;

  const cx = (startX + endX - 1) / 2;
  const cy = (startY + endY - 1) / 2;
  const rx = Math.max(1, (endX - startX) / 2);
  const ry = Math.max(1, (endY - startY) / 2);

  const lumaAt = (x: number, y: number): number => {
    const i = (y * imgWidth + x) * 4;
    return luminanceRgb(data[i], data[i + 1], data[i + 2]);
  };

  let fillLinR = 0;
  let fillLinG = 0;
  let fillLinB = 0;
  let fillWeightTotal = 0;
  const domFreq = new Map<number, { count: number; sumR: number; sumG: number; sumB: number }>();
  const edgeBins = new Map<number, { weight: number; sumR: number; sumG: number; sumB: number }>();
  let bestEdgeKey = 0;
  let bestEdgeWeight = -1;
  let edgeWeightTotal = 0;
  let edgePixels = 0;
  let sampleCount = 0;

  for (let y = startY; y < endY; y++) {
    for (let x = startX; x < endX; x++) {
      const index = (y * imgWidth + x) * 4;
      if (data[index + 3] < 128) continue;

      const r = data[index];
      const g = data[index + 1];
      const b = data[index + 2];

      const lum = lumaAt(x, y);
      const rightLum = lumaAt(Math.min(x + 1, imgWidth - 1), y);
      const bottomLum = lumaAt(x, Math.min(y + 1, imgHeight - 1));
      const edgeStrength = (Math.abs(lum - rightLum) + Math.abs(lum - bottomLum)) / 255;

      const nx = (x - cx) / rx;
      const ny = (y - cy) / ry;
      const centerWeight = 1 + Math.max(0, 1 - (nx * nx + ny * ny)) * 0.35;

      fillLinR += srgbChannelToLinear(r) * centerWeight;
      fillLinG += srgbChannelToLinear(g) * centerWeight;
      fillLinB += srgbChannelToLinear(b) * centerWeight;
      fillWeightTotal += centerWeight;

      if (edgeStrength < edgeMin) {
        addToQuantizedBin(domFreq, r, g, b);
      }

      if (edgeStrength >= edgeMin) {
        const key = quantizedColorKey(r, g, b);
        const edgeW = centerWeight * Math.min(2, edgeStrength);
        let bin = edgeBins.get(key);
        if (bin) {
          bin.weight += edgeW;
          bin.sumR += r * edgeW;
          bin.sumG += g * edgeW;
          bin.sumB += b * edgeW;
        } else {
          bin = { weight: edgeW, sumR: r * edgeW, sumG: g * edgeW, sumB: b * edgeW };
          edgeBins.set(key, bin);
        }
        if (bin.weight > bestEdgeWeight) {
          bestEdgeWeight = bin.weight;
          bestEdgeKey = key;
        }
        edgeWeightTotal += edgeW;
        edgePixels += 1;
      }

      sampleCount += 1;
    }
  }

  if (fillWeightTotal <= 0 || sampleCount <= 0) return null;

  const fillR = linearChannelToSrgb(fillLinR / fillWeightTotal);
  const fillG = linearChannelToSrgb(fillLinG / fillWeightTotal);
  const fillB = linearChannelToSrgb(fillLinB / fillWeightTotal);
  const fillLuma = luminanceRgb(fillR, fillG, fillB);

  const edgeRatio = edgePixels / sampleCount;
  const edgeShare = edgeWeightTotal > 0 ? bestEdgeWeight / edgeWeightTotal : 0;
  const edge = edgeWeightTotal > 0 ? edgeBins.get(bestEdgeKey) : undefined;

  if (
    edge &&
    edge.weight > 0 &&
    edgeRatio >= edgeRatioMin &&
    edgeShare >= edgeShareMin
  ) {
    const edgeR = edge.sumR / edge.weight;
    const edgeG = edge.sumG / edge.weight;
    const edgeB = edge.sumB / edge.weight;
    const edgeLuma = luminanceRgb(edgeR, edgeG, edgeB);
    if (edgeLuma <= fillLuma - edgeLumaDelta) {
      return {
        r: Math.round(edgeR),
        g: Math.round(edgeG),
        b: Math.round(edgeB),
      };
    }
  }

  // 有边缘但未选中描边色时，线性平均易发灰 → 回退平坦区域主色
  if (edgePixels > 0) {
    const dom = bestBinColor(domFreq);
    if (dom) return dom;
  }

  return { r: fillR, g: fillG, b: fillB };
}

export type CalculatePixelGridOptions = {
  /** Floyd–Steinberg 抖动：限色时用邻格误差扩散保留渐变层次 */
  dithering?: boolean;
};

/**
 * 根据原始图像数据、网格尺寸、调色板和模式计算像素化网格数据。
 * EdgeAware / Dominant 会额外做线稿掩码：细描边格子强制取暗色，避免被填充色淹没。
 * 开启 dithering 时跳过描边强制映射，先取代表色再抖动量化。
 */
export function calculatePixelGrid(
  originalCtx: CanvasRenderingContext2D,
  imgWidth: number,
  imgHeight: number,
  N: number,
  M: number,
  palette: PaletteColor[],
  mode: PixelationMode,
  t1FallbackColor: PaletteColor, // 传入备用色
  options?: CalculatePixelGridOptions,
): MappedPixel[][] {
  const dithering = options?.dithering === true;
  console.log(`Calculating pixel grid with mode: ${mode}, dithering: ${dithering}`);
  const mappedData: MappedPixel[][] = Array(M)
    .fill(null)
    .map(() => Array(N).fill({ key: t1FallbackColor.key, color: t1FallbackColor.hex }));
  const cellWidthOriginal = imgWidth / N;
  const cellHeightOriginal = imgHeight / M;

  let fullImageData: ImageData | null = null;
  try {
    fullImageData = originalCtx.getImageData(0, 0, imgWidth, imgHeight);
  } catch (e) {
    console.error('Failed to get full image data:', e);
    return mappedData;
  }

  // 小画布：轻度对比度+锐化。不再预加粗暗线（会把 1px 线扩成 2~3 格黑边）
  fullImageData = enhanceImageDataForSmallGrid(fullImageData, N, M);
  const cellArea = (imgWidth / N) * (imgHeight / M);
  // 抖动路径用连续代表色，跳过描边强制，避免误差扩散被打断
  const preserveLines = !dithering && mode !== PixelationMode.Average;

  // 描边掩码：提高覆盖率门槛、禁止膨胀，避免「沾一点黑就整格变黑边」
  const strokeMask =
    preserveLines
      ? extractStrokeMask(
          fullImageData.data,
          imgWidth,
          imgHeight,
          N,
          M,
          100, // 只认更明确的暗线，略过浅灰抗锯齿边
          cellArea >= 64 ? 0.12 : 0.15,
          0, // 不膨胀掩码
        )
      : null;

  const representativeGrid: (RgbColor | null)[][] = Array.from({ length: M }, () =>
    Array.from({ length: N }, () => null),
  );
  const strokeFlags: boolean[][] = Array.from({ length: M }, () =>
    Array.from({ length: N }, () => false),
  );

  for (let j = 0; j < M; j++) {
    for (let i = 0; i < N; i++) {
      const startXOriginal = Math.floor(i * cellWidthOriginal);
      const startYOriginal = Math.floor(j * cellHeightOriginal);
      const endXOriginal = Math.min(imgWidth, Math.ceil((i + 1) * cellWidthOriginal));
      const endYOriginal = Math.min(imgHeight, Math.ceil((j + 1) * cellHeightOriginal));
      const currentCellWidth = Math.max(1, endXOriginal - startXOriginal);
      const currentCellHeight = Math.max(1, endYOriginal - startYOriginal);

      let representativeRgb: RgbColor | null = null;
      const isStroke = strokeMask?.[j * N + i] === true;
      if (isStroke) {
        representativeRgb = sampleStrokeCellColor(
          fullImageData.data,
          imgWidth,
          imgHeight,
          startXOriginal,
          startYOriginal,
          endXOriginal,
          endYOriginal,
          120,
        );
      }
      // 描边格若取色仍偏亮（白描边/抗锯齿），改回正常代表色，避免白边被强行染黑
      if (
        isStroke &&
        representativeRgb &&
        luminanceRgb(representativeRgb.r, representativeRgb.g, representativeRgb.b) > 160
      ) {
        representativeRgb = null;
      }
      if (!representativeRgb) {
        representativeRgb = calculateCellRepresentativeColor(
          fullImageData,
          startXOriginal,
          startYOriginal,
          currentCellWidth,
          currentCellHeight,
          mode,
        );
      }

      representativeGrid[j][i] = representativeRgb;
      strokeFlags[j][i] = isStroke && representativeRgb !== null;
    }
  }

  if (dithering) {
    const dithered = applyFloydSteinbergDither(
      representativeGrid,
      palette,
      findClosestPaletteColor,
    );
    console.log(`Pixel grid calculation complete for mode: ${mode} (dithered)`);
    return dithered;
  }

  for (let j = 0; j < M; j++) {
    for (let i = 0; i < N; i++) {
      const representativeRgb = representativeGrid[j][i];
      const isStroke = strokeFlags[j][i];

      let finalCellColorData: MappedPixel;
      if (representativeRgb) {
        let closestBead: PaletteColor;
        if (isStroke) {
          const strokeLuma = luminanceRgb(
            representativeRgb.r,
            representativeRgb.g,
            representativeRgb.b,
          );
          // 描边偏暗时，限制到偏暗色板，避免映射成浅灰珠
          const darkPalette =
            strokeLuma < 140
              ? palette.filter((p) => luminanceRgb(p.rgb.r, p.rgb.g, p.rgb.b) <= 170)
              : palette;
          closestBead = findClosestPaletteColor(
            representativeRgb,
            darkPalette.length > 0 ? darkPalette : palette,
          );
        } else {
          closestBead = findClosestPaletteColor(representativeRgb, palette);
        }
        finalCellColorData = { key: closestBead.key, color: closestBead.hex };
      } else {
        finalCellColorData = { ...transparentColorData };
      }
      mappedData[j][i] = finalCellColorData;
    }
  }
  console.log(`Pixel grid calculation complete for mode: ${mode}`);
  return mappedData;
}
