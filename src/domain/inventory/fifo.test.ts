import { describe, expect, it } from 'vitest';
import { allocateFifo, previewFifoAllocations } from './fifo';

describe('allocateFifo', () => {
  it('allocates across lots in order', () => {
    const result = allocateFifo(
      [
        { id: 'a', remainingQty: 30 },
        { id: 'b', remainingQty: 50 },
      ],
      40,
    );
    expect(result.ok).toBe(true);
    expect(result.allocations).toEqual([
      { lotId: 'a', quantity: 30 },
      { lotId: 'b', quantity: 10 },
    ]);
  });

  it('fails when short', () => {
    const result = allocateFifo([{ id: 'a', remainingQty: 10 }], 20);
    expect(result.ok).toBe(false);
    expect(result.allocations).toEqual([]);
  });
});

describe('previewFifoAllocations', () => {
  it('reports shortfall hex', () => {
    const map = new Map([['#AAAAAA', [{ id: '1', remainingQty: 5 }]]]);
    const result = previewFifoAllocations(map, [{ hex: '#AAAAAA', quantity: 10 }]);
    expect(result.ok).toBe(false);
    expect(result.shortfallHex).toBe('#AAAAAA');
  });
});
