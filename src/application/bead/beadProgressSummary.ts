import type { MappedPixel } from '../../domain/pixelation';
import type { Pattern } from '../../domain/pattern';

export type BeadProgressStatus =
  | 'empty'
  | 'not_started'
  | 'in_progress'
  | 'paused'
  | 'completed';

/** 用户可手动设定的拼豆阶段（不含 empty） */
export type BeadCraftPhase = Exclude<BeadProgressStatus, 'empty'>;

export type BeadProgressSummary = {
  done: number;
  total: number;
  remaining: number;
  percent: number;
  status: BeadProgressStatus;
  /** 是否由用户手动覆盖（暂停等） */
  isManual?: boolean;
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

function autoStatus(done: number, total: number): BeadCraftPhase {
  if (done >= total) return 'completed';
  if (done > 0) return 'in_progress';
  return 'not_started';
}

/** 合并格子进度与手动阶段 */
export function resolveBeadStatus(
  auto: BeadCraftPhase,
  manualStatus: BeadCraftPhase | undefined | null,
): { status: BeadCraftPhase; isManual: boolean } {
  if (!manualStatus) return { status: auto, isManual: false };
  // 暂停始终尊重手动标记
  if (manualStatus === 'paused') return { status: 'paused', isManual: true };
  // 其余手动状态优先（格子会在 setCraftStatus 时同步）
  if (manualStatus !== auto) return { status: manualStatus, isManual: true };
  return { status: auto, isManual: false };
}

/** 由图纸像素与已拼格子推导列表页进度摘要 */
export function summarizeBeadProgress(
  pattern: Pick<Pattern, 'data'>,
  completedCells: string[] | undefined | null,
  manualStatus?: BeadCraftPhase | null,
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
  const auto = autoStatus(done, total);
  const resolved = resolveBeadStatus(auto, manualStatus);

  return {
    done,
    total,
    remaining,
    percent,
    status: resolved.status,
    isManual: resolved.isManual,
  };
}

export function beadProgressStatusLabel(status: BeadProgressStatus): string {
  switch (status) {
    case 'completed':
      return '已全部拼完';
    case 'paused':
      return '已暂停';
    case 'in_progress':
      return '拼豆中';
    case 'not_started':
      return '还未开始拼';
    default:
      return '尚未生成格子';
  }
}

export function beadCraftCtaLabel(status: BeadProgressStatus): string {
  switch (status) {
    case 'in_progress':
    case 'paused':
      return '继续拼豆';
    case 'completed':
      return '查看';
    default:
      return '开始拼豆';
  }
}
