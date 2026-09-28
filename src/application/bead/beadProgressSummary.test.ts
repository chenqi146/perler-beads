import { describe, expect, it } from 'vitest';
import {
  beadCraftCtaLabel,
  summarizeBeadProgress,
} from './beadProgressSummary';
import type { PatternData } from '../../domain/pattern';
import type { MappedPixel } from '../../domain/pixelation';

function cell(color: string, isExternal = false): MappedPixel {
  return { key: color, color, isExternal };
}

function patternData(
  mappedPixelData: MappedPixel[][],
  totalBeadCount = 0,
): Pick<{ data: PatternData }, 'data'> {
  return {
    data: {
      mappedPixelData,
      gridDimensions: {
        N: mappedPixelData[0]?.length ?? 0,
        M: mappedPixelData.length,
      },
      colorCounts: null,
      totalBeadCount,
      originalImageSrc: null,
      originalImageKey: null,
      selectedColorSystem: 'MARD',
    },
  };
}

describe('summarizeBeadProgress', () => {
  it('returns empty when no cells', () => {
    const summary = summarizeBeadProgress(patternData([]), []);
    expect(summary.status).toBe('empty');
    expect(summary.total).toBe(0);
  });

  it('counts internal cells and remaining', () => {
    const mapped = [
      [cell('#111111'), cell('#222222', true)],
      [cell('#111111'), cell('#333333')],
    ];
    const summary = summarizeBeadProgress(patternData(mapped), ['0,0', '1,0']);
    expect(summary.total).toBe(3);
    expect(summary.done).toBe(2);
    expect(summary.remaining).toBe(1);
    expect(summary.status).toBe('in_progress');
  });

  it('marks completed when all internal cells done', () => {
    const mapped = [[cell('#111111'), cell('#222222')]];
    const summary = summarizeBeadProgress(patternData(mapped), ['0,0', '0,1']);
    expect(summary.status).toBe('completed');
    expect(summary.percent).toBe(100);
  });

  it('ignores completed keys that point to external cells', () => {
    const mapped = [[cell('#111111'), cell('#222222', true)]];
    const summary = summarizeBeadProgress(patternData(mapped), ['0,1']);
    expect(summary.done).toBe(0);
    expect(summary.status).toBe('not_started');
  });
});

describe('beadCraftCtaLabel', () => {
  it('maps status to CTA copy', () => {
    expect(beadCraftCtaLabel('not_started')).toBe('开始拼豆');
    expect(beadCraftCtaLabel('in_progress')).toBe('继续拼豆');
    expect(beadCraftCtaLabel('completed')).toBe('查看');
  });
});
