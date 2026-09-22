/**
 * 像素化前的源图外观调整（对比度 / 饱和度）。
 * 数值约定与常见图像编辑器一致：0 = 不变，正数增强，负数减弱；建议范围 -50～50。
 */

export type ImageAdjustOptions = {
  /** 对比度：0 不变，+20 ≈ 略拉开深浅 */
  contrast?: number;
  /** 饱和度：0 不变，+20 ≈ 略提色 */
  saturation?: number;
};

const clampByte = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
const clampAdjust = (v: number) => Math.max(-50, Math.min(50, Math.round(v) || 0));

export function normalizeImageAdjust(value: number): number {
  return clampAdjust(value);
}

/**
 * 就地/返回调整后的 ImageData。contrast、saturation 均为 0 时原样返回。
 */
export function adjustImageData(
  imageData: ImageData,
  options: ImageAdjustOptions = {},
): ImageData {
  const contrast = clampAdjust(options.contrast ?? 0);
  const saturation = clampAdjust(options.saturation ?? 0);
  if (contrast === 0 && saturation === 0) return imageData;

  const c = (100 + contrast) / 100;
  const s = (100 + saturation) / 100;
  const src = imageData.data;
  const out = new Uint8ClampedArray(src.length);

  for (let i = 0; i < src.length; i += 4) {
    const a = src[i + 3];
    if (a < 128) {
      out[i] = src[i];
      out[i + 1] = src[i + 1];
      out[i + 2] = src[i + 2];
      out[i + 3] = a;
      continue;
    }

    const r = (src[i] - 128) * c + 128;
    const g = (src[i + 1] - 128) * c + 128;
    const b = (src[i + 2] - 128) * c + 128;

    const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    // 近白低彩度像素不抬饱和度，避免描边抗锯齿被放大成色边
    const maxDev = Math.max(Math.abs(r - gray), Math.abs(g - gray), Math.abs(b - gray));
    const isNearWhiteLowChroma = gray > 200 && maxDev < 15;
    const es = isNearWhiteLowChroma ? Math.min(1, s) : s;
    const flatten = isNearWhiteLowChroma && maxDev < 8;
    const dr = flatten ? 0 : (r - gray) * es;
    const dg = flatten ? 0 : (g - gray) * es;
    const db = flatten ? 0 : (b - gray) * es;

    out[i] = clampByte(gray + dr);
    out[i + 1] = clampByte(gray + dg);
    out[i + 2] = clampByte(gray + db);
    out[i + 3] = a;
  }

  return {
    data: out,
    width: imageData.width,
    height: imageData.height,
    colorSpace: imageData.colorSpace,
  } as ImageData;
}
