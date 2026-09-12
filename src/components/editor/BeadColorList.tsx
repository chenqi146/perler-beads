'use client';

import { getColorKeyByHex, type ColorSystem } from '../../domain/palette';

export type RegionSortMode = 'nearest' | 'largest' | 'edge';

type BeadColorListProps = {
  sortedColors: string[];
  colorCounts: Record<string, { count: number; color: string }> | null | undefined;
  colorSystem: ColorSystem;
  highlightHex: string | null;
  completedSet: Set<string>;
  /** hex → 已完成格数 */
  cellProgress: Record<string, { done: number; total: number }>;
  justCompleted: string | null;
  regionSortMode: RegionSortMode;
  onRegionSortModeChange: (mode: RegionSortMode) => void;
  onToggleHighlight: (hex: string) => void;
  onToggleComplete: (hex: string, next: boolean) => void;
};

const SORT_OPTIONS: { id: RegionSortMode; label: string }[] = [
  { id: 'nearest', label: '最近' },
  { id: 'largest', label: '大块' },
  { id: 'edge', label: '边缘' },
];

export function BeadColorList({
  sortedColors,
  colorCounts,
  colorSystem,
  highlightHex,
  completedSet,
  cellProgress,
  justCompleted,
  regionSortMode,
  onRegionSortModeChange,
  onToggleHighlight,
  onToggleComplete,
}: BeadColorListProps) {
  return (
    <aside className="flex min-h-0 flex-col rounded-xl border border-[#eadfce] bg-[#fffaf3] p-3">
      <div className="mb-2 shrink-0">
        <h2 className="text-sm font-semibold text-[#3a2416]">颜色统计</h2>
        <p className="mt-0.5 text-[11px] text-[#8a6a4a]">点色号高亮 · 点格子完成</p>
        <div className="mt-2 flex gap-1" role="group" aria-label="区域推荐排序">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => onRegionSortModeChange(opt.id)}
              className={[
                'h-7 flex-1 rounded-lg text-[11px] font-medium transition-colors',
                regionSortMode === opt.id
                  ? 'bg-[#c47a2c] text-white'
                  : 'bg-white text-[#5c4030] ring-1 ring-[#e0d0bc] hover:bg-[#fff4e6]',
              ].join(' ')}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain pr-0.5">
        {sortedColors.map((hex) => {
          const count = colorCounts?.[hex]?.count ?? 0;
          const color = colorCounts?.[hex]?.color ?? hex;
          const displayKey = getColorKeyByHex(hex, colorSystem);
          const active = highlightHex?.toUpperCase() === hex.toUpperCase();
          const done = completedSet.has(hex.toUpperCase());
          const pop = justCompleted === hex.toUpperCase();
          const progress = cellProgress[hex.toUpperCase()] ?? cellProgress[hex];
          const doneCells = progress?.done ?? 0;
          const totalCells = progress?.total ?? count;

          return (
            <div
              key={hex}
              className={[
                'flex items-center gap-2 rounded-xl border px-2 py-1.5 transition-[background-color,border-color,transform] duration-150',
                active ? 'border-[#c47a2c] bg-[#fff4e6]' : 'border-transparent hover:bg-[#f3e6d4]/50',
                done ? 'opacity-60' : '',
                pop ? 'scale-[1.02]' : '',
              ].join(' ')}
            >
              <button
                type="button"
                onClick={() => onToggleHighlight(hex)}
                className="flex min-w-0 flex-1 items-center gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e8b86a]"
                aria-pressed={active}
              >
                <span
                  className="h-6 w-6 shrink-0 rounded-md border border-black/10"
                  style={{ backgroundColor: color }}
                  aria-hidden="true"
                />
                <span
                  className={`min-w-0 flex-1 truncate font-mono text-xs ${done ? 'line-through text-[#8a6a4a]' : 'text-[#3a2416]'}`}
                >
                  {displayKey}
                </span>
                <span className="shrink-0 text-[11px] tabular-nums text-[#8a6a4a]">
                  {doneCells}/{totalCells}
                </span>
              </button>
              <label className="flex shrink-0 cursor-pointer items-center gap-1 text-[11px] font-medium text-[#5c4030]">
                <input
                  type="checkbox"
                  checked={done}
                  onChange={(event) => onToggleComplete(hex, event.target.checked)}
                  className="h-4 w-4 rounded border-[#e0d0bc] accent-[#c47a2c]"
                  aria-label={`标记 ${displayKey} 完成`}
                />
                完成
              </label>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
