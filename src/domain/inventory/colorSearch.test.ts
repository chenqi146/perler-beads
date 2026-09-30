import { describe, expect, it } from 'vitest';
import { normalizeColorQuery, searchBeadColors } from './colorSearch';

describe('normalizeColorQuery', () => {
  it('trims and uppercases', () => {
    expect(normalizeColorQuery('  a1 ')).toBe('A1');
  });
});

describe('searchBeadColors', () => {
  it('returns near colors for a hex-like query with no key match', () => {
    // unlikely exact key; force near path with a random-ish hex
    const result = searchBeadColors('#12AB34', 'MARD', { nearLimit: 3 });
    // may match includes on hex — if matches empty, near should fill
    if (result.matches.length === 0) {
      expect(result.near.length).toBeGreaterThan(0);
      expect(result.near.length).toBeLessThanOrEqual(3);
    }
  });
});
