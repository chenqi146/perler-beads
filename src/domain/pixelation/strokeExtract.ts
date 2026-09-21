/**
 * 线稿提取：细描边在格子里占比极低，需单独掩码 + 强制取暗色。
 */

export type StrokeRgb = { r: number; g: number; b: number };
export function extractStrokeMask(
  srcData: Uint8ClampedArray,
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number,
  lumaThreshold = 110,
  coverageThreshold = 0.06,
  dilateRadius = 0,
): boolean[] {
  const mask: boolean[] = new Array(dstW * dstH);
  for (let dy = 0; dy < dstH; dy++) {
    const sy0 = Math.floor((dy * srcH) / dstH);
    const sy1 = Math.max(sy0 + 1, Math.floor(((dy + 1) * srcH) / dstH));
    for (let dx = 0; dx < dstW; dx++) {
      const sx0 = Math.floor((dx * srcW) / dstW);
      const sx1 = Math.max(sx0 + 1, Math.floor(((dx + 1) * srcW) / dstW));
      let dark = 0;
      let total = 0;
      let localDark = 0;

      // 单元格内亮度统计，用于「相对暗于局部」判定（粉/灰细线）
      let sumLuma = 0;
      let opaque = 0;
      for (let sy = sy0; sy < sy1; sy++) {
        for (let sx = sx0; sx < sx1; sx++) {
          const off = (sy * srcW + sx) * 4;
          if (srcData[off + 3] < 10) continue;
          const luma =
            0.2126 * srcData[off] + 0.7152 * srcData[off + 1] + 0.0722 * srcData[off + 2];
          sumLuma += luma;
          opaque++;
        }
      }
      const meanLuma = opaque > 0 ? sumLuma / opaque : 255;
      // 相对暗：比格子均值暗 28 以上，且本身不太亮
      const relativeDarkCut = Math.min(meanLuma - 28, 200);

      for (let sy = sy0; sy < sy1; sy++) {
        for (let sx = sx0; sx < sx1; sx++) {
          total++;
          const off = (sy * srcW + sx) * 4;
          if (srcData[off + 3] < 10) continue;
          const luma =
            0.2126 * srcData[off] + 0.7152 * srcData[off + 1] + 0.0722 * srcData[off + 2];
          if (luma < lumaThreshold) dark++;
          if (luma < relativeDarkCut) localDark++;
        }
      }

      const ratio = total > 0 ? Math.max(dark, localDark) / total : 0;
      mask[dy * dstW + dx] = total > 0 && ratio >= coverageThreshold;
    }
  }
  return dilateRadius > 0 ? dilateMask(mask, dstW, dstH, dilateRadius) : mask;
}

function dilateMask(mask: boolean[], width: number, height: number, radius: number): boolean[] {
  const r = Math.max(1, Math.min(2, radius));
  const out = mask.slice();
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!mask[y * width + x]) continue;
      for (let dy = -r; dy <= r; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= height) continue;
        for (let dx = -r; dx <= r; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= width) continue;
          out[ny * width + nx] = true;
        }
      }
    }
  }
  return out;
}

/**
 * 描边格取色：只统计暗像素（绝对暗或相对暗于格子均值），避免被大面积填充色淹没。
 */
export function sampleStrokeCellColor(
  srcData: Uint8ClampedArray,
  srcW: number,
  srcH: number,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  lumaThreshold = 110,
): StrokeRgb | null {
  let sumLuma = 0;
  let opaque = 0;
  for (let y = startY; y < endY; y++) {
    for (let x = startX; x < endX; x++) {
      const off = (y * srcW + x) * 4;
      if (srcData[off + 3] < 128) continue;
      sumLuma += 0.2126 * srcData[off] + 0.7152 * srcData[off + 1] + 0.0722 * srcData[off + 2];
      opaque++;
    }
  }
  if (opaque === 0) return null;
  const meanLuma = sumLuma / opaque;
  const relativeCut = Math.min(meanLuma - 28, lumaThreshold + 20);

  let rSum = 0;
  let gSum = 0;
  let bSum = 0;
  let count = 0;
  let darkest: StrokeRgb | null = null;
  let darkestLuma = Infinity;

  for (let y = startY; y < endY; y++) {
    for (let x = startX; x < endX; x++) {
      const off = (y * srcW + x) * 4;
      if (srcData[off + 3] < 128) continue;
      const r = srcData[off];
      const g = srcData[off + 1];
      const b = srcData[off + 2];
      const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      if (luma < darkestLuma) {
        darkestLuma = luma;
        darkest = { r, g, b };
      }
      if (luma < lumaThreshold || luma < relativeCut) {
        rSum += r;
        gSum += g;
        bSum += b;
        count++;
      }
    }
  }

  if (count > 0) {
    return {
      r: Math.round(rSum / count),
      g: Math.round(gSum / count),
      b: Math.round(bSum / count),
    };
  }
  return darkest;
}

/**
 * 在源图上轻微加粗暗线（1px 膨胀），让细描边在降采样后仍占到格子。
 */
export function thickenDarkStrokes(
  imageData: ImageData,
  lumaThreshold = 110,
): ImageData {
  const w = imageData.width;
  const h = imageData.height;
  const src = imageData.data;
  const out = new Uint8ClampedArray(src);

  const isDark = (i: number) => {
    if (src[i + 3] < 128) return false;
    return 0.2126 * src[i] + 0.7152 * src[i + 1] + 0.0722 * src[i + 2] < lumaThreshold;
  };

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = (y * w + x) * 4;
      if (isDark(i)) continue;
      // 邻域有暗像素则把当前像素染成最暗邻域色
      let bestI = -1;
      let bestL = Infinity;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const ni = ((y + dy) * w + (x + dx)) * 4;
          if (!isDark(ni)) continue;
          const luma = 0.2126 * src[ni] + 0.7152 * src[ni + 1] + 0.0722 * src[ni + 2];
          if (luma < bestL) {
            bestL = luma;
            bestI = ni;
          }
        }
      }
      if (bestI >= 0) {
        out[i] = src[bestI];
        out[i + 1] = src[bestI + 1];
        out[i + 2] = src[bestI + 2];
        out[i + 3] = 255;
      }
    }
  }

  return { data: out, width: w, height: h, colorSpace: imageData.colorSpace } as ImageData;
}
