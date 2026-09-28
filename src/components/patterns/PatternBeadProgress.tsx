'use client';

import Link from 'next/link';
import type { BeadProgressSummary } from '@/application/bead/beadProgressSummary';

type Props = {
  patternId: string;
  summary: BeadProgressSummary;
  /** 空图纸时不展示进度行 */
  disabled?: boolean;
};

/** 列表卡片上的已拼 / 未拼进度，点击进入拼豆页查看 */
export function PatternBeadProgress({ patternId, summary, disabled }: Props) {
  if (disabled || summary.status === 'empty') {
    return (
      <p className="pattern-bead-progress is-empty" aria-label="尚无拼豆格子">
        尚未生成格子
      </p>
    );
  }

  const label =
    summary.status === 'completed'
      ? '已全部拼完'
      : summary.status === 'not_started'
        ? '还未开始拼'
        : `进度 ${summary.percent}%`;

  return (
    <Link
      href={`/bead/${patternId}`}
      className={[
        'pattern-bead-progress',
        summary.status === 'completed' ? 'is-completed' : '',
        summary.status === 'in_progress' ? 'is-active' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      aria-label={`${label}，已拼 ${summary.done}，未拼 ${summary.remaining}，点击查看`}
    >
      <div className="pattern-bead-progress-meta">
        <span className="pattern-bead-progress-label">{label}</span>
        <span className="pattern-bead-progress-counts">
          已拼 {summary.done}
          <span aria-hidden="true"> · </span>
          未拼 {summary.remaining}
        </span>
      </div>
      <div
        className="pattern-bead-progress-track"
        role="progressbar"
        aria-valuenow={summary.done}
        aria-valuemin={0}
        aria-valuemax={summary.total}
        aria-label="拼豆完成进度"
      >
        <div
          className="pattern-bead-progress-fill"
          style={{ width: `${summary.percent}%` }}
        />
      </div>
    </Link>
  );
}
