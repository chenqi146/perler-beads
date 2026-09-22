import { describe, expect, it } from 'vitest';
import {
  PixelationMode,
  calculateCellRepresentativeColor,
  colorDistance,
  findClosestPaletteColor,
  hexToRgb,
} from './pixelation';
import type { MappedPixel, PaletteColor } from './pixelation';
import { cleanupPixelGrid, majorityFilter, removeIsolatedNoise } from './patternCleanup';
import { extractStrokeMask, sampleStrokeCellColor } from './strokeExtract';

function makeImageData(width: number, height: number, rgba: number[]): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  data.set(rgba);
  return { data, width, height, colorSpace: 'srgb' } as ImageData;
}

describe('hexToRgb', () => {
  it('parses 6-digit hex', () => {
    expect(hexToRgb('#FF8040')).toEqual({ r: 255, g: 128, b: 64 });
  });

  it('returns null for invalid hex', () => {
    expect(hexToRgb('not-a-color')).toBeNull();
  });
});

describe('colorDistance', () => {
  it('returns 0 for identical colors', () => {
    const rgb = { r: 10, g: 20, b: 30 };
    expect(colorDistance(rgb, rgb)).toBe(0);
  });

  it('increases with channel difference', () => {
    const a = { r: 0, g: 0, b: 0 };
    const b = { r: 10, g: 0, b: 0 };
    const c = { r: 20, g: 0, b: 0 };
    expect(colorDistance(a, c)).toBeGreaterThan(colorDistance(a, b));
  });
});

describe('findClosestPaletteColor near-white', () => {
  const palette: PaletteColor[] = [
    { key: 'T01', hex: '#FFFFFF', rgb: { r: 255, g: 255, b: 255 } },
    { key: 'H09', hex: '#EDEDED', rgb: { r: 237, g: 237, b: 237 } },
    { key: 'H10', hex: '#EEE9EA', rgb: { r: 238, g: 233, b: 234 } },
    { key: 'H02', hex: '#FEFFFF', rgb: { r: 254, g: 255, b: 255 } },
  ];

  it('maps pure white to T01', () => {
    expect(findClosestPaletteColor({ r: 255, g: 255, b: 255 }, palette).key).toBe('T01');
  });

  it('maps light gray background to H09 not T01', () => {
    expect(findClosestPaletteColor({ r: 240, g: 240, b: 240 }, palette).key).toBe('H09');
  });

  it('maps #E8E8E8 away from pure white T01', () => {
    const key = findClosestPaletteColor({ r: 232, g: 232, b: 232 }, palette).key;
    expect(key).not.toBe('T01');
    expect(key).not.toBe('H02');
  });
});

describe('calculateCellRepresentativeColor', () => {
  it('returns null for fully transparent cells', () => {
    const img = makeImageData(2, 2, [
      255, 0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0,
    ]);
    expect(
      calculateCellRepresentativeColor(img, 0, 0, 2, 2, PixelationMode.Average),
    ).toBeNull();
  });

  it('Average uses linear RGB (dark+light mid is darker than sRGB mean)', () => {
    const img = makeImageData(2, 1, [0, 0, 0, 255, 255, 255, 255, 255]);
    const result = calculateCellRepresentativeColor(
      img,
      0,
      0,
      2,
      1,
      PixelationMode.Average,
    );
    expect(result).not.toBeNull();
    expect(result!.r).toBeGreaterThan(180);
    expect(result!.r).toBeLessThan(195);
    expect(result!.r).toBe(result!.g);
    expect(result!.g).toBe(result!.b);
  });

  it('Dominant picks quantized majority and averages within the bin', () => {
    const img = makeImageData(2, 2, [
      200, 10, 10, 255,
      202, 12, 8, 255,
      199, 11, 9, 255,
      0, 0, 255, 255,
    ]);
    const result = calculateCellRepresentativeColor(
      img,
      0,
      0,
      2,
      2,
      PixelationMode.Dominant,
    );
    expect(result).not.toBeNull();
    expect(result!.r).toBeGreaterThan(190);
    expect(result!.b).toBeLessThan(30);
  });

  it('Dominant merges near-identical RGB via 6-bit bins', () => {
    const img = makeImageData(3, 1, [
      100, 100, 100, 255,
      101, 100, 100, 255,
      50, 50, 200, 255,
    ]);
    const result = calculateCellRepresentativeColor(
      img,
      0,
      0,
      3,
      1,
      PixelationMode.Dominant,
    );
    expect(result).not.toBeNull();
    expect(result!.r).toBeGreaterThan(95);
    expect(result!.r).toBeLessThan(105);
    expect(result!.b).toBeLessThan(110);
  });

  it('EdgeAware prefers dark outline over washed fill on high-contrast cell', () => {
    // 3x3：中心与左侧为黑描边，右侧大块白底；边缘模式应偏黑
    const rgba: number[] = [];
    for (let y = 0; y < 3; y++) {
      for (let x = 0; x < 3; x++) {
        const isEdge = x === 0 || (x === 1 && y === 1);
        if (isEdge) rgba.push(10, 10, 10, 255);
        else rgba.push(250, 250, 250, 255);
      }
    }
    const img = makeImageData(3, 3, rgba);
    const result = calculateCellRepresentativeColor(
      img,
      0,
      0,
      3,
      3,
      PixelationMode.EdgeAware,
    );
    expect(result).not.toBeNull();
    // 应明显偏暗（描边），而不是接近白灰
    expect(result!.r).toBeLessThan(80);
  });

  it('EdgeAware keeps peach leg column against light blue background', () => {
    // 8x8：中间两列肉色腿，两侧浅蓝；平均会冲成蓝，主色应保住肉色
    const peach = [232, 190, 160];
    const blue = [168, 200, 224];
    const rgba: number[] = [];
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const isLeg = x === 3 || x === 4;
        const c = isLeg ? peach : blue;
        rgba.push(c[0], c[1], c[2], 255);
      }
    }
    const img = makeImageData(8, 8, rgba);
    const result = calculateCellRepresentativeColor(
      img,
      0,
      0,
      8,
      8,
      PixelationMode.EdgeAware,
    );
    expect(result).not.toBeNull();
    // 应偏肉色（R 明显高于 B），而不是浅蓝底
    expect(result!.r).toBeGreaterThan(result!.b + 20);
    expect(result!.r).toBeGreaterThan(200);
  });

  it('EdgeAware keeps off-center peach strip via second-color contest', () => {
    // 腿偏在格子左侧（非正中），全格主色仍是蓝
    const peach = [232, 190, 160];
    const blue = [168, 200, 224];
    const rgba: number[] = [];
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const isLeg = x === 1 || x === 2;
        const c = isLeg ? peach : blue;
        rgba.push(c[0], c[1], c[2], 255);
      }
    }
    const img = makeImageData(8, 8, rgba);
    const result = calculateCellRepresentativeColor(
      img,
      0,
      0,
      8,
      8,
      PixelationMode.EdgeAware,
    );
    expect(result).not.toBeNull();
    expect(result!.r).toBeGreaterThan(result!.b + 20);
  });
});

describe('strokeExtract', () => {
  it('marks thin dark line cells even at low coverage', () => {
    // 10x10 白底，中间一列黑线 → 下采样到 2x2 时含黑线的列应命中
    const w = 10;
    const h = 10;
    const rgba: number[] = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (x === 4) rgba.push(20, 20, 20, 255);
        else rgba.push(245, 245, 245, 255);
      }
    }
    const data = new Uint8ClampedArray(rgba);
    const mask = extractStrokeMask(data, w, h, 2, 2, 110, 0.06, 0);
    // 左列单元格含 x=0..4，覆盖黑线；右列 x=5..9 无黑线
    expect(mask[0] || mask[2]).toBe(true); // left column cells
  });

  it('sampleStrokeCellColor ignores majority fill', () => {
    // 8 白 + 1 黑
    const rgba = [
      255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
      255, 255, 255, 255, 15, 15, 15, 255, 255, 255, 255, 255,
      255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
    ];
    const data = new Uint8ClampedArray(rgba);
    const color = sampleStrokeCellColor(data, 3, 3, 0, 0, 3, 3, 110);
    expect(color).not.toBeNull();
    expect(color!.r).toBeLessThan(40);
  });
});

describe('patternCleanup', () => {
  const cell = (key: string, color: string): MappedPixel => ({
    key,
    color,
    isExternal: false,
  });

  it('majorityFilter replaces minority center when neighbors agree', () => {
    const a = cell('A', '#C8C8C8');
    const b = cell('B', '#C4C4C4'); // 近同色碎点，应被多数吞掉
    const grid: MappedPixel[][] = [
      [a, a, a],
      [a, b, a],
      [a, a, a],
    ];
    const out = majorityFilter(grid, 5);
    expect(out[1][1].key).toBe('A');
  });

  it('majorityFilter keeps hue-different center even if luma is close', () => {
    const bg = cell('BG', '#A8C8E0');
    const leg = cell('LEG', '#E8E8E8');
    const grid: MappedPixel[][] = [
      [bg, bg, bg],
      [bg, leg, bg],
      [bg, bg, bg],
    ];
    const out = majorityFilter(grid, 5);
    expect(out[1][1].key).toBe('LEG');
  });

  it('removeIsolatedNoise removes single-pixel speck', () => {
    const a = cell('A', '#808080');
    const b = cell('B', '#818181'); // low contrast vs A
    const grid: MappedPixel[][] = [
      [a, a, a],
      [a, b, a],
      [a, a, a],
    ];
    const out = removeIsolatedNoise(grid, 2);
    expect(out[1][1].key).toBe('A');
  });

  it('cleanupPixelGrid keeps high-contrast outline speck', () => {
    const white = cell('W', '#FFFFFF');
    const black = cell('K', '#000000');
    const grid: MappedPixel[][] = [
      [white, white, white],
      [white, black, white],
      [white, white, white],
    ];
    const out = cleanupPixelGrid(grid);
    // 高对比应保留黑点（描边）
    expect(out[1][1].key).toBe('K');
  });

  it('strong cleanup removes low-contrast speckles', () => {
    const a = cell('A', '#C8C8C8');
    const b = cell('B', '#C0C0C0');
    const grid: MappedPixel[][] = [
      [a, a, a],
      [a, b, a],
      [a, a, a],
    ];
    const out = cleanupPixelGrid(grid, 'strong');
    expect(out[1][1].key).toBe('A');
  });

  it('strong cleanup keeps light gray leg column against light blue bg', () => {
    const bg = cell('BG', '#A8C8E0');
    const leg = cell('LEG', '#E8E8E8');
    // 5×5：中间一列浅灰腿，两侧浅蓝底（亮度接近、色相不同）
    const grid: MappedPixel[][] = Array.from({ length: 5 }, () =>
      [bg, bg, leg, bg, bg].map((c) => ({ ...c })),
    );
    const out = cleanupPixelGrid(grid, 'strong');
    for (let r = 0; r < 5; r++) {
      expect(out[r][2].key).toBe('LEG');
    }
  });
});
