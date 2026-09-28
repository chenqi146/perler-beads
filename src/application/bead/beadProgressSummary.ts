import type { MappedPixel } from '../../domain/pixelation';
import type { Pattern } from '../../domain/pattern';

export type BeadProgressStatus = 'empty' | 'not_started' | 'in_progress' | 'completed';

export type BeadProgressSummary = {
  done: number;
  total: number;
  remaining: number;
  percent: number;
  status: BeadProgressStatus;
};

function countInternalCells(mappedPixelData: MappedPixel[][] | null | undefined): number {
  if (!mappedPixelData?.length) return 0;
  let total = 0;
  for (let r = 0; r < mappedPixelData.length; r++) {
    const row = mappedPixelData[r];
    if (!row) continue;
    for (let c = 0; c < row.length; c++) {
      const cell = row[c];
      if (cell && !cell.isExternal) total += 1;
    }
  }
  return total;
}

function countValidCompleted(
  mappedPixelData: MappedPixel[][] | null | undefined,
  completedCells: string[],
): number {
  if (!completedCells.length) return 0;
  if (!mappedPixelData?.length) return completedCells.length;

  let done = 0;
  for (const key of completedCells) {
    const [rs, cs] = key.split(',');
    const r = Number(rs);
    const c = Number(cs);
    if (!Number.isFinite(r) || !Number.isFinite(c)) continue;
    const cell = mappedPixelData[r]?.[c];
    if (cell && !cell.isExternal) done += 1;
  }
  return done;
}

/** 由图纸像素与已拼格子推导列表页进度摘要 */
export function summarizeBeadProgress(
  pattern: Pick<Pattern, 'data'>,
  completedCells: string[] | undefined | null,
): BeadProgressSummary {
  const mapped = pattern.data.mappedPixelData;
  const fromGrid = countInternalCells(mapped);
  const total =
    fromGrid > 0
      ? fromGrid
      : Math.max(0, pattern.data.totalBeadCount || 0);

  if (total <= 0) {
    return { done: 0, total: 0, remaining: 0, percent: 0, status: 'empty' };
  }

  const done = Math.min(total, countValidCompleted(mapped, completedCells ?? []));
  const remaining = Math.max(0, total - done);
  const percent = Math.round((done / total) * 100);

  let status: BeadProgressStatus = 'not_started';
  if (done >= total) status = 'completed';
  else if (done > 0) status = 'in_progress';

  return { done, total, remaining, percent, status };
}

export function beadCraftCtaLabel(status: BeadProgressStatus): string {
  switch (status) {
    case 'in_progress':
      return '继续拼豆';
    case 'completed':
      return '查看';
    default:
      return '开始拼豆';
  }
}
