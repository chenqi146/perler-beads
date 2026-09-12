import type { MappedPixel } from './pixelation';

/**
 * 根据 mappedPixelData 生成合成的 originalImageSrc（CSV 导入等无原图场景）。
 * 每个单元格用 8×8 像素绘制以确保清晰度。
 */
export function generateSyntheticImageFromPixelData(
  pixelData: MappedPixel[][],
  dimensions: { N: number; M: number },
): string {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    console.error('无法创建canvas上下文');
    return '';
  }

  const pixelSize = 8;
  canvas.width = dimensions.N * pixelSize;
  canvas.height = dimensions.M * pixelSize;

  pixelData.forEach((row, rowIndex) => {
    row.forEach((cell, colIndex) => {
      if (cell) {
        const color = cell.isExternal ? '#FFFFFF' : cell.color;
        ctx.fillStyle = color;
        ctx.fillRect(
          colIndex * pixelSize,
          rowIndex * pixelSize,
          pixelSize,
          pixelSize,
        );
      }
    });
  });

  return canvas.toDataURL('image/png');
}
