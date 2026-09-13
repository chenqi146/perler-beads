'use client';

import { getColorKeyByHex, type ColorSystem } from '../../domain/palette';

export const GRID_INTERVAL_OPTIONS = [5, 10, 15, 20] as const;
export type GridIntervalOption = (typeof GRID_INTERVAL_OPTIONS)[number];

type BeadColorListProps = {
  sortedColors: string[];
  colorCounts: Record<string, { count: number; color: string }> | null | undefined;
  colorSystem: ColorSystem;
  highlightHex: string | null;
  completedSet: Set<string>;
  /** hex → 已完成格数 */
  cellProgress: Record<string, { done: number; total: number }>;
  justCompleted: string | null;
  gridInterval: number;
  onGridIntervalChange: (interval: number) => void;
  /** 0–100：其他颜色淡化强度 */
  highlightFadePercent: number;
  onHighlightFadeChange: (percent: number) => void;
  onToggleHighlight: (hex: string) => void;
  onToggleComplete: (hex: string, next: boolean) => void;
  onDeleteColor: (hex: string) => void;
};

export function BeadColorList({
  sortedColors,
  colorCounts,
  colorSystem,
  highlightHex,
  completedSet,
  cellProgress,
  justCompleted,
  gridInterval,
  onGridIntervalChange,
  highlightFadePercent,
  onHighlightFadeChange,
  onToggleHighlight,
  onToggleComplete,
  onDeleteColor,
}: BeadColorListProps) {
  return (
    <aside className="flex min-h-0 flex-col rounded-xl border border-[#eadfce] bg-[#fffaf3] p-3">
      <div className="mb-2 shrink-0 space-y-2">
        <div>
          <h2 className="text-sm font-semibold text-[#3a2416]">颜色统计</h2>
          <p className="mt-0.5 text-[11px] text-[#8a6a4a]">点色号高亮 · 点格子完成 · 删除可擦除</p>
        </div>
        <div>
          <p className="mb-1 text-[11px] text-[#8a6a4a]">分割线（每 N 格）</p>
          <div className="flex gap-1" role="group" aria-label="网格分割线间隔">
            {GRID_INTERVAL_OPTIONS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => onGridIntervalChange(n)}
                className={[
                  'h-7 flex-1 rounded-lg text-[11px] font-medium tabular-nums transition-colors',
                  gridInterval === n
                    ? 'bg-[#c47a2c] text-white'
                    : 'bg-white text-[#5c4030] ring-1 ring-[#e0d0bc] hover:bg-[#fff4e6]',
                ].join(' ')}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between gap-2">
            <label htmlFor="bead-highlight-fade" className="text-[11px] text-[#8a6a4a]">
              其他颜色淡化
            </label>
            <span className="text-[11px] font-medium tabular-nums text-[#5c4030]">
              {highlightFadePercent}
            </span>
          </div>
          <input
            id="bead-highlight-fade"
            type="range"
            min={0}
            max={100}
            step={1}
            value={highlightFadePercent}
            onChange={(e) => onHighlightFadeChange(parseInt(e.target.value, 10))}
            className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-[#e8dcc8] accent-[#c47a2c]"
          />
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
                'flex items-center gap-1.5 rounded-xl border px-2 py-1.5 transition-[background-color,border-color,transform] duration-150',
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
              <button
                type="button"
                onClick={() => onDeleteColor(hex)}
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[#a08060] transition-colors hover:bg-[#f3e0d0] hover:text-[#b33b2a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e8b86a]"
                title={`删除 ${displayKey}`}
                aria-label={`删除色号 ${displayKey}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 7h12M9 7V5h6v2m-8 0l1 12h8l1-12" />
                </svg>
              </button>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
