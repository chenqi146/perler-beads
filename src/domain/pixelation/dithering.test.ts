import { describe, expect, it } from 'vitest';
import { applyFloydSteinbergDither } from './dithering';
import { findClosestPaletteColor, type PaletteColor, type RgbColor } from './pixelation';

const palette: PaletteColor[] = [
  { key: 'B', hex: '#000000', rgb: { r: 0, g: 0, b: 0 } },
  { key: 'W', hex: '#FFFFFF', rgb: { r: 255, g: 255, b: 255 } },
];

describe('applyFloydSteinbergDither', () => {
  it('maps solid mid gray into a mix of black and white', () => {
    const mid: RgbColor = { r: 128, g: 128, b: 128 };
    const cells = Array.from({ length: 4 }, () =>
      Array.from({ length: 4 }, () => ({ ...mid })),
    );
    const result = applyFloydSteinbergDither(cells, palette, findClosestPaletteColor);
    const keys = result.flat().map((c) => c.key);
    expect(keys.includes('B')).toBe(true);
    expect(keys.includes('W')).toBe(true);
  });

  it('keeps null cells transparent', () => {
    const cells: (RgbColor | null)[][] = [
      [null, { r: 0, g: 0, b: 0 }],
      [{ r: 255, g: 255, b: 255 }, null],
    ];
    const result = applyFloydSteinbergDither(cells, palette, findClosestPaletteColor);
    expect(result[0][0].key).toBe('ERASE');
    expect(result[1][1].key).toBe('ERASE');
    expect(result[0][1].key).toBe('B');
    expect(result[1][0].key).toBe('W');
  });
});
