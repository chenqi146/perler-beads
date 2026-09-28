'use client';

import type { BeadProgressStatus } from '@/application/bead/beadProgressSummary';

export type PatternProgressFilter = 'all' | BeadProgressStatus;

const FILTERS: { value: PatternProgressFilter; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'not_started', label: '未拼' },
  { value: 'in_progress', label: '拼豆中' },
  { value: 'paused', label: '已暂停' },
  { value: 'completed', label: '已拼完' },
  { value: 'empty', label: '无格子' },
];

type Props = {
  query: string;
  onQueryChange: (value: string) => void;
  progressFilter: PatternProgressFilter;
  onProgressFilterChange: (value: PatternProgressFilter) => void;
  resultCount: number;
  totalCount: number;
};

/** 图纸列表查询：名称搜索 + 已拼/未拼筛选 */
export function PatternListQueryBar({
  query,
  onQueryChange,
  progressFilter,
  onProgressFilterChange,
  resultCount,
  totalCount,
}: Props) {
  return (
    <div className="pattern-list-query">
      <label className="pattern-list-query-search">
        <span className="sr-only">搜索图纸</span>
        <input
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="搜索图纸名称或描述…"
          autoComplete="off"
          enterKeyHint="search"
        />
      </label>
      <div className="pattern-list-query-filters" role="group" aria-label="按拼豆进度筛选">
        {FILTERS.map((item) => {
          const active = progressFilter === item.value;
          return (
            <button
              key={item.value}
              type="button"
              className={active ? 'is-active' : undefined}
              aria-pressed={active}
              onClick={() => onProgressFilterChange(item.value)}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      <p className="pattern-list-query-count" aria-live="polite">
        {query.trim() || progressFilter !== 'all'
          ? `找到 ${resultCount} / ${totalCount} 张`
          : `共 ${totalCount} 张`}
      </p>
    </div>
  );
}
