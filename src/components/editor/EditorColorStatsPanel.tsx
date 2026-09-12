'use client';

import { ColorSwatch } from '../ui/ColorSwatch';
import { getColorKeyByHex, type ColorSystem } from '../../utils/colorSystemUtils';

function sortColorKeys(a: string, b: string): number {
  const regex = /^([A-Z]+)(\d+)$/;
  const matchA = a.match(regex);
  const matchB = b.match(regex);

  if (matchA && matchB) {
    const prefixA = matchA[1];
    const numA = parseInt(matchA[2], 10);
    const prefixB = matchB[1];
    const numB = parseInt(matchB[2], 10);

    if (prefixA !== prefixB) {
      return prefixA.localeCompare(prefixB);
    }
    return numA - numB;
  }
  return a.localeCompare(b);
}

export type EditorColorStatsPanelProps = {
  colorCounts: { [key: string]: { count: number; color: string } };
  totalBeadCount: number;
  selectedColorSystem: ColorSystem;
  highlightColorKey: string | null | undefined;
  onSelectAllByColor: (hexKey: string) => void;
};

/** 预览区右侧颜色统计列表：点击全选该色号格子 */
export function EditorColorStatsPanel({
  colorCounts,
  totalBeadCount,
  selectedColorSystem,
  highlightColorKey,
  onSelectAllByColor,
}: EditorColorStatsPanelProps) {
  return (
    <aside className="color-stats-panel flex w-full shrink-0 flex-col rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-950/60 lg:h-full lg:min-h-0 lg:w-[220px] xl:w-[250px]">
      <div className="mb-2 shrink-0">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">颜色统计</h3>
        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
          共 {Object.keys(colorCounts).length} 色 · {totalBeadCount.toLocaleString()} 颗 · 点击全选该色
        </p>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto space-y-1 pr-0.5">
        {Object.keys(colorCounts)
          .sort(sortColorKeys)
          .map((hexKey) => {
            const displayColorKey = getColorKeyByHex(hexKey, selectedColorSystem);
            const count = colorCounts[hexKey].count;
            const colorHex = colorCounts[hexKey].color;
            const isActiveHighlight = highlightColorKey?.toUpperCase() === hexKey.toUpperCase();
            return (
              <button
                key={hexKey}
                type="button"
                onClick={() => onSelectAllByColor(hexKey)}
                title={`选中全部 ${displayColorKey}（${count} 格）`}
                className={`flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-left transition-colors ${
                  isActiveHighlight
                    ? 'border-blue-400 bg-blue-50 dark:border-blue-500 dark:bg-blue-900/40 ring-1 ring-blue-300'
                    : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 bg-white dark:bg-gray-900/30'
                }`}
              >
                <ColorSwatch hex={colorHex} size="sm" />
                <span className="min-w-0 flex-1 truncate font-mono text-xs text-gray-800 dark:text-gray-200">
                  {displayColorKey}
                </span>
                <span className="text-[11px] shrink-0 text-gray-500 dark:text-gray-400">{count}</span>
              </button>
            );
          })}
      </div>
    </aside>
  );
}
