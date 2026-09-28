import { describe, expect, it } from 'vitest';
import type { PaletteColor } from './pixelation';
import {
  areLinesStable,
  buildEvenGrid,
  cropImageDataToContent,
  detectGrid,
  downscaleImageDataForRecognition,
  estimateRecognizeColorBudget,
  mergeSimilarRgbClusters,
  recognizePatternFromImageData,
  sampleCellRgb,
} from './patternRecognition';

function makeImageData(width: number, height: number, fill: (x: number, y: number) => [number, number, number]): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b] = fill(x, y);
      const i = (y * width + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
  }
  return { data, width, height, colorSpace: 'srgb' } as ImageData;
}

const palette: PaletteColor[] = [
  { key: 'R01', hex: '#E53935', rgb: { r: 229, g: 57, b: 53 } },
  { key: 'B01', hex: '#1E88E5', rgb: { r: 30, g: 136, b: 229 } },
  { key: 'G01', hex: '#43A047', rgb: { r: 67, g: 160, b: 71 } },
  { key: 'T01', hex: '#FFFFFF', rgb: { r: 255, g: 255, b: 255 } },
];

/** 合成 4x3 棋盘格 + 深灰网格线 */
function makeGridChart(cols: number, rows: number, cell = 12, line = 2): ImageData {
  const w = cols * cell + (cols + 1) * line;
  const h = rows * cell + (rows + 1) * line;
  const colors: [number, number, number][] = [
    [229, 57, 53],
    [30, 136, 229],
    [67, 160, 71],
    [255, 255, 255],
  ];

  return makeImageData(w, h, (x, y) => {
    // 判定是否在网格线上
    let inLineX = false;
    let inLineY = false;
    let acc = 0;
    for (let c = 0; c <= cols; c++) {
      if (x >= acc && x < acc + line) inLineX = true;
      acc += line + (c < cols ? cell : 0);
    }
    acc = 0;
    for (let r = 0; r <= rows; r++) {
      if (y >= acc && y < acc + line) inLineY = true;
      acc += line + (r < rows ? cell : 0);
    }
    if (inLineX || inLineY) return [40, 40, 40];

    // 格子坐标
    let col = -1;
    let row = -1;
    let cx = line;
    for (let c = 0; c < cols; c++) {
      if (x >= cx && x < cx + cell) {
        col = c;
        break;
      }
      cx += cell + line;
    }
    let cy = line;
    for (let r = 0; r < rows; r++) {
      if (y >= cy && y < cy + cell) {
        row = r;
        break;
      }
      cy += cell + line;
    }
    if (col < 0 || row < 0) return [40, 40, 40];
    return colors[(row * cols + col) % colors.length];
  });
}

describe('areLinesStable', () => {
  it('accepts evenly spaced lines', () => {
    expect(areLinesStable([0, 14, 28, 42, 56])).toBe(true);
  });

  it('rejects irregular spacing', () => {
    expect(areLinesStable([0, 10, 40, 45])).toBe(false);
  });
});

describe('downscaleImageDataForRecognition', () => {
  it('keeps small images unchanged by reference', () => {
    const img = makeImageData(40, 30, () => [1, 2, 3]);
    expect(downscaleImageDataForRecognition(img, 1600)).toBe(img);
  });

  it('shrinks long edge to maxEdge', () => {
    const img = makeImageData(200, 100, () => [10, 20, 30]);
    const out = downscaleImageDataForRecognition(img, 100);
    expect(Math.max(out.width, out.height)).toBe(100);
    expect(out.width).toBe(100);
    expect(out.height).toBe(50);
  });
});

describe('buildEvenGrid', () => {
  it('splits image into requested cells', () => {
    const img = makeImageData(40, 30, () => [255, 0, 0]);
    const grid = buildEvenGrid(img, 4, 3);
    expect(grid.cols).toBe(4);
    expect(grid.rows).toBe(3);
    expect(grid.xLines).toHaveLength(5);
    expect(grid.yLines).toHaveLength(4);
    expect(grid.xLines[0]).toBe(0);
    expect(grid.xLines[4]).toBe(40);
    expect(grid.source).toBe('manual');
  });
});

describe('cropImageDataToContent', () => {
  it('crops large white margins around content', () => {
    const img = makeImageData(80, 60, (x, y) => {
      if (x >= 20 && x < 50 && y >= 15 && y < 45) return [200, 40, 40];
      return [255, 255, 255];
    });
    const cropped = cropImageDataToContent(img);
    expect(cropped.width).toBeLessThan(img.width);
    expect(cropped.height).toBeLessThan(img.height);
  });
});

describe('detectGrid', () => {
  it('detects synthetic bead chart grid size', () => {
    const img = makeGridChart(4, 3, 14, 2);
    const grid = detectGrid(img);
    expect(grid).not.toBeNull();
    expect(grid!.cols).toBe(4);
    expect(grid!.rows).toBe(3);
    expect(grid!.source).toBe('auto');
  });
});

describe('recognizePatternFromImageData', () => {
  it('throws when palette is empty', () => {
    const img = makeImageData(20, 20, () => [255, 0, 0]);
    expect(() =>
      recognizePatternFromImageData(img, {
        palette: [],
        fallbackCols: 4,
        fallbackRows: 4,
      }),
    ).toThrow(/色板为空/);
  });

  it('auto-detects grid chart and maps to palette keys', () => {
    const img = makeGridChart(4, 3, 14, 2);
    const result = recognizePatternFromImageData(img, {
      palette,
      fallbackCols: 10,
      fallbackRows: 10,
      preferAutoGrid: true,
    });
    expect(result.gridDimensions).toEqual({ N: 4, M: 3 });
    expect(result.gridSource).toBe('auto');
    expect(result.mappedPixelData).toHaveLength(3);
    expect(result.mappedPixelData[0]).toHaveLength(4);
    const keys = new Set(result.mappedPixelData.flat().map((c) => c.key));
    expect(keys.has('R01') || keys.has('B01') || keys.has('G01') || keys.has('T01')).toBe(true);
  });

  it('falls back to manual grid for solid color image', () => {
    const img = makeImageData(48, 36, () => [229, 57, 53]);
    const result = recognizePatternFromImageData(img, {
      palette,
      fallbackCols: 4,
      fallbackRows: 3,
      preferAutoGrid: true,
    });
    expect(result.gridDimensions).toEqual({ N: 4, M: 3 });
    expect(result.gridSource === 'manual' || result.gridSource === 'manual-cropped').toBe(true);
    expect(result.mappedPixelData.every((row) => row.every((c) => c.key === 'R01'))).toBe(true);
  });

  it('ignores dark ink glyphs when sampling cell fill', () => {
    // 底色红，中心画黑字迹
    const img = makeImageData(20, 20, (x, y) => {
      if (x >= 7 && x <= 12 && y >= 7 && y <= 12) return [20, 20, 20];
      return [229, 57, 53];
    });
    const rgb = sampleCellRgb(img, 0, 0, 20, 20);
    expect(rgb).not.toBeNull();
    expect(rgb!.r).toBeGreaterThan(180);
    expect(rgb!.g).toBeLessThan(100);
  });

  it('respects maxColors after recognition', () => {
    const img = makeGridChart(4, 3, 14, 2);
    const result = recognizePatternFromImageData(img, {
      palette,
      fallbackCols: 10,
      fallbackRows: 10,
      preferAutoGrid: true,
      maxColors: 2,
    });
    const keys = new Set(result.mappedPixelData.flat().map((c) => c.key));
    expect(keys.size).toBeLessThanOrEqual(2);
  });

  it('manual size wins over mismatched auto-detect count', () => {
    // 4×3 可检出，但用户指定 8×6：应在网格区域内按 8×6 均分
    const img = makeGridChart(4, 3, 16, 2);
    const result = recognizePatternFromImageData(img, {
      palette,
      fallbackCols: 8,
      fallbackRows: 6,
      preferAutoGrid: false,
    });
    expect(result.gridDimensions).toEqual({ N: 8, M: 6 });
    expect(result.mappedPixelData).toHaveLength(6);
    expect(result.mappedPixelData[0]).toHaveLength(8);
  });
});

describe('estimateRecognizeColorBudget', () => {
  it('keeps dominant colors and drops long tail', () => {
    expect(estimateRecognizeColorBudget([1655, 939, 871, 514, 455, 427, 346, 314, 274, 210, 16, 3, 2, 1])).toBe(11);
  });
});

describe('mergeSimilarRgbClusters', () => {
  it('merges near-duplicate jpeg bins', () => {
    const { clusters } = mergeSimilarRgbClusters(
      [
        { id: 1, count: 100, sumR: 22900, sumG: 5700, sumB: 5300 },
        { id: 2, count: 8, sumR: 220 * 8, sumG: 60 * 8, sumB: 55 * 8 },
        { id: 3, count: 50, sumR: 30 * 50, sumG: 136 * 50, sumB: 229 * 50 },
      ],
      12,
    );
    expect(clusters.length).toBe(2);
  });
});
