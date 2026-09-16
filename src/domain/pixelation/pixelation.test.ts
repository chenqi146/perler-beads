import { describe, expect, it } from 'vitest';
import { colorDistance, hexToRgb } from './pixelation';

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
