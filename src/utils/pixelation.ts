import { transparentColorData } from './pixelEditingUtils';

// 定义像素化模式
export enum PixelationMode {
  Dominant = 'dominant', // 卡通模式（主色）
  Average = 'average',   // 真实模式（平均色）
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

/**
 * 计算图像指定区域的代表色（根据所选模式）
 * @param imageData 包含像素数据的 ImageData 对象
 * @param startX 区域起始 X 坐标
 * @param startY 区域起始 Y 坐标
 * @param width 区域宽度
 * @param height 区域高度
 * @param mode 计算模式 ('dominant' 或 'average')
 * @returns 代表色的 RGB 对象，或 null（如果区域无效或全透明）
 */
function calculateCellRepresentativeColor(
    imageData: ImageData,
    startX: number,
    startY: number,
    width: number,
    height: number,
    mode: PixelationMode
): RgbColor | null {
    const data = imageData.data;
    const imgWidth = imageData.width;
    let rSum = 0, gSum = 0, bSum = 0;
    let pixelCount = 0;
    const colorCountsInCell: { [key: string]: number } = {};
    let dominantColorRgb: RgbColor | null = null;
    let maxCount = 0;

    const endX = startX + width;
    const endY = startY + height;

    for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
            const index = (y * imgWidth + x) * 4;
            // 检查 alpha 通道，忽略完全透明的像素
            if (data[index + 3] < 128) continue;

            const r = data[index];
            const g = data[index + 1];
            const b = data[index + 2];

            pixelCount++;

            if (mode === PixelationMode.Average) {
                rSum += r;
                gSum += g;
                bSum += b;
            } else { // Dominant mode
                const colorKey = `${r},${g},${b}`;
                colorCountsInCell[colorKey] = (colorCountsInCell[colorKey] || 0) + 1;
                if (colorCountsInCell[colorKey] > maxCount) {
                    maxCount = colorCountsInCell[colorKey];
                    dominantColorRgb = { r, g, b };
                }
            }
        }
    }

    if (pixelCount === 0) {
        return null; // 区域内没有不透明像素
    }

    if (mode === PixelationMode.Average) {
        return {
            r: Math.round(rSum / pixelCount),
            g: Math.round(gSum / pixelCount),
            b: Math.round(bSum / pixelCount),
        };
    } else { // Dominant mode
        return dominantColorRgb; // 可能为 null 如果只有一个透明像素
    }
}

/**
 * 根据原始图像数据、网格尺寸、调色板和模式计算像素化网格数据。
 * @param originalCtx 原始图像的 Canvas 2D Context
 * @param imgWidth 原始图像宽度
 * @param imgHeight 原始图像高度
 * @param N 网格横向数量
 * @param M 网格纵向数量
 * @param palette 当前使用的调色板
 * @param mode 像素化模式 (Dominant/Average)
 * @param t1FallbackColor T1 或其他备用颜色数据
 * @returns 计算后的 MappedPixel 网格数据
 */
export function calculatePixelGrid(
    originalCtx: CanvasRenderingContext2D,
    imgWidth: number,
    imgHeight: number,
    N: number,
    M: number,
    palette: PaletteColor[],
    mode: PixelationMode,
    t1FallbackColor: PaletteColor // 传入备用色
): MappedPixel[][] {
    console.log(`Calculating pixel grid with mode: ${mode}`);
    const mappedData: MappedPixel[][] = Array(M).fill(null).map(() => Array(N).fill({ key: t1FallbackColor.key, color: t1FallbackColor.hex }));
    const cellWidthOriginal = imgWidth / N;
    const cellHeightOriginal = imgHeight / M;

    let fullImageData: ImageData | null = null;
    try {
        fullImageData = originalCtx.getImageData(0, 0, imgWidth, imgHeight);
    } catch (e) {
        console.error("Failed to get full image data:", e);
        // 如果无法获取图像数据，返回一个空的或默认的网格
        return mappedData;
    }

    for (let j = 0; j < M; j++) {
        for (let i = 0; i < N; i++) {
            const startXOriginal = Math.floor(i * cellWidthOriginal);
            const startYOriginal = Math.floor(j * cellHeightOriginal);
            // 计算精确的单元格结束位置，避免超出图像边界
            const endXOriginal = Math.min(imgWidth, Math.ceil((i + 1) * cellWidthOriginal));
            const endYOriginal = Math.min(imgHeight, Math.ceil((j + 1) * cellHeightOriginal));
            // 计算实际的单元格宽高
            const currentCellWidth = Math.max(1, endXOriginal - startXOriginal);
            const currentCellHeight = Math.max(1, endYOriginal - startYOriginal);

            // 使用提取的函数计算代表色
            const representativeRgb = calculateCellRepresentativeColor(
                fullImageData,
                startXOriginal,
                startYOriginal,
                currentCellWidth,
                currentCellHeight,
                mode
            );

            let finalCellColorData: MappedPixel;
            if (representativeRgb) {
                const closestBead = findClosestPaletteColor(representativeRgb, palette);
                finalCellColorData = { key: closestBead.key, color: closestBead.hex };
            } else {
                // 如果单元格为空或全透明，标记为透明/外部
                finalCellColorData = { ...transparentColorData };
            }
            mappedData[j][i] = finalCellColorData;
        }
    }
    console.log(`Pixel grid calculation complete for mode: ${mode}`);
    return mappedData;
} 
