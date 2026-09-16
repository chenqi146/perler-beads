'use client';

export const GRID_INTERVAL_OPTIONS = [5, 10, 15, 20] as const;
export type GridIntervalOption = (typeof GRID_INTERVAL_OPTIONS)[number];

export type BeadCraftSettingsProps = {
  gridInterval: number;
  onGridIntervalChange: (interval: number) => void;
  highlightFadePercent: number;
  onHighlightFadeChange: (percent: number) => void;
  showCellKeys: boolean;
  onShowCellKeysChange: (show: boolean) => void;
  idPrefix?: string;
};

/** 拼豆网格/淡化/色号开关，供桌面侧栏与移动 sheet 复用 */
export function BeadCraftSettings({
  gridInterval,
  onGridIntervalChange,
  highlightFadePercent,
  onHighlightFadeChange,
  showCellKeys,
  onShowCellKeysChange,
  idPrefix = 'bead',
}: BeadCraftSettingsProps) {
  const fadeId = `${idPrefix}-highlight-fade`;
  return (
    <div className="space-y-3">
      <div>
        <p className="mb-1 text-[11px] text-[#8a6a4a]">分割线（每 N 格）</p>
        <div className="flex gap-1" role="group" aria-label="网格分割线间隔">
          {GRID_INTERVAL_OPTIONS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onGridIntervalChange(n)}
              className={[
                'h-9 flex-1 touch-manipulation rounded-lg text-[11px] font-medium tabular-nums transition-colors',
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
          <label htmlFor={fadeId} className="text-[11px] text-[#8a6a4a]">
            其他颜色淡化
          </label>
          <span className="text-[11px] font-medium tabular-nums text-[#5c4030]">
            {highlightFadePercent}
          </span>
        </div>
        <input
          id={fadeId}
          type="range"
          min={0}
          max={100}
          step={1}
          value={highlightFadePercent}
          onChange={(e) => onHighlightFadeChange(parseInt(e.target.value, 10))}
          className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-[#e8dcc8] accent-[#c47a2c]"
        />
      </div>
      <label className="flex min-h-11 cursor-pointer items-center justify-between gap-2 text-[11px] text-[#8a6a4a]">
        <span>显示色号编码</span>
        <input
          type="checkbox"
          checked={showCellKeys}
          onChange={(e) => onShowCellKeysChange(e.target.checked)}
          className="h-5 w-5 rounded border-[#e0d0bc] accent-[#c47a2c]"
        />
      </label>
    </div>
  );
}
