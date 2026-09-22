import { describe, expect, it } from 'vitest';
import { adjustImageData, normalizeImageAdjust } from './imageAdjust';

function makeImageData(width: number, height: number, rgba: number[]): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  data.set(rgba);
  return { data, width, height, colorSpace: 'srgb' } as ImageData;
}

describe('normalizeImageAdjust', () => {
  it('clamps to -50..50', () => {
    expect(normalizeImageAdjust(80)).toBe(50);
    expect(normalizeImageAdjust(-80)).toBe(-50);
    expect(normalizeImageAdjust(12.4)).toBe(12);
  });
});

describe('adjustImageData', () => {
  it('returns same reference when both adjustments are 0', () => {
    const img = makeImageData(1, 1, [100, 120, 140, 255]);
    expect(adjustImageData(img, { contrast: 0, saturation: 0 })).toBe(img);
  });

  it('increases channel spread with positive contrast', () => {
    const img = makeImageData(1, 1, [180, 180, 180, 255]);
    const out = adjustImageData(img, { contrast: 40, saturation: 0 });
    expect(out.data[0]).toBeGreaterThan(180);
  });

  it('boosts chroma with positive saturation', () => {
    const img = makeImageData(1, 1, [200, 100, 100, 255]);
    const out = adjustImageData(img, { contrast: 0, saturation: 40 });
    // red channel should move further from green/blue
    const beforeSpread = 200 - 100;
    const afterSpread = out.data[0] - out.data[1];
    expect(afterSpread).toBeGreaterThan(beforeSpread);
  });

  it('leaves transparent pixels unchanged', () => {
    const img = makeImageData(1, 1, [200, 50, 50, 0]);
    const out = adjustImageData(img, { contrast: 40, saturation: 40 });
    expect([...out.data]).toEqual([200, 50, 50, 0]);
  });
});
