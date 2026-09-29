'use client';

import type { ReactNode } from 'react';
import type { BeadProgressStatus } from '@/application/bead/beadProgressSummary';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export type PatternProgressFilter = 'all' | BeadProgressStatus;

const PROGRESS_OPTIONS: { value: PatternProgressFilter; label: string }[] = [
  { value: 'all', label: '全部进度' },
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
  /** 额外筛选字段（可见性、标签等），插入字段行 */
  extraFields?: ReactNode;
  /** 有额外筛选生效时，结果文案走「找到 x / y」 */
  hasExtraFilters?: boolean;
};

/** 图纸列表查询：搜索 + 可扩展筛选字段 */
export function PatternListQueryBar({
  query,
  onQueryChange,
  progressFilter,
  onProgressFilterChange,
  resultCount,
  totalCount,
  extraFields,
  hasExtraFilters = false,
}: Props) {
  const filtered =
    Boolean(query.trim()) || progressFilter !== 'all' || hasExtraFilters;

  return (
    <div className="pattern-list-query">
      <div className="pattern-list-query-row">
        <label className="pattern-list-query-search">
          <span className="sr-only">搜索图纸</span>
          <input
            type="search"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="搜索图纸…"
            autoComplete="off"
            enterKeyHint="search"
          />
        </label>

        <div className="pattern-list-query-field">
          <span>进度</span>
          <Select
            value={progressFilter}
            onValueChange={(value) =>
              onProgressFilterChange(value as PatternProgressFilter)
            }
          >
            <SelectTrigger
              className="h-10 w-full bg-white"
              size="default"
              aria-label="按拼豆进度筛选"
            >
              <SelectValue placeholder="全部进度" />
            </SelectTrigger>
            <SelectContent position="popper" align="start">
              <SelectGroup>
                {PROGRESS_OPTIONS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        <p className="pattern-list-query-count" aria-live="polite">
          {filtered ? `找到 ${resultCount} / ${totalCount} 张` : `共 ${totalCount} 张`}
        </p>
      </div>

      {extraFields ? (
        <div className="pattern-list-query-fields">{extraFields}</div>
      ) : null}
    </div>
  );
}
