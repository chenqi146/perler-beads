'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ColorSwatch } from '../ui/ColorSwatch';
import { getColorKeyByHex, type ColorSystem } from '../../utils/colorSystemUtils';
import { useInventoryStockMap, type StockLevel } from '@/application/inventory/useInventoryStockMap';
import { hexToPathParam } from '@/domain/inventory';

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

function badgeClass(level: StockLevel): string {
  switch (level) {
    case 'ok':
      return 'bg-[#d4e8c2] text-[#3a5a20]';
    case 'low':
      return 'bg-[#f3e0c0] text-[#8a5a20]';
    case 'none':
      return 'bg-[#f0e0d8] text-[#8a4a40]';
    default:
      return 'bg-transparent text-transparent';
  }
}

function badgeLabel(level: StockLevel): string {
  switch (level) {
    case 'ok':
      return '有';
    case 'low':
      return '少';
    case 'none':
      return '无';
    default:
      return '';
  }
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
  const { getQty, levelFor, ready } = useInventoryStockMap();
  const [popoverHex, setPopoverHex] = useState<string | null>(null);

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
            const level = levelFor(hexKey, count);
            const qty = getQty(hexKey);
            const showPopover = popoverHex?.toUpperCase() === hexKey.toUpperCase();

            return (
              <div key={hexKey} className="relative">
                <div
                  className={`flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 transition-colors ${
                    isActiveHighlight
                      ? 'border-blue-400 bg-blue-50 dark:border-blue-500 dark:bg-blue-900/40 ring-1 ring-blue-300'
                      : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/30'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onSelectAllByColor(hexKey)}
                    title={`选中全部 ${displayColorKey}（${count} 格）`}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left hover:opacity-90"
                  >
                    <ColorSwatch hex={colorHex} size="sm" />
                    <span className="min-w-0 flex-1 truncate font-mono text-xs text-gray-800 dark:text-gray-200">
                      {displayColorKey}
                    </span>
                    <span className="text-[11px] shrink-0 text-gray-500 dark:text-gray-400">{count}</span>
                  </button>
                  {ready && level !== 'unknown' ? (
                    <button
                      type="button"
                      className={`rounded px-1 text-[10px] font-semibold ${badgeClass(level)}`}
                      title={`豆仓余量 ${qty}`}
                      onClick={() => setPopoverHex(showPopover ? null : hexKey)}
                    >
                      {badgeLabel(level)}
                    </button>
                  ) : null}
                </div>
                {showPopover ? (
                  <div className="absolute right-0 top-full z-20 mt-1 w-40 rounded-lg border border-[#eadfce] bg-[#fffaf3] p-2 text-[11px] text-[#5c4030] shadow-md">
                    <p>
                      余量 <strong>{qty}</strong> · 本图 {count}
                    </p>
                    <Link
                      href={`/inventory?quick=1&hex=${encodeURIComponent(hexKey)}`}
                      className="mt-1 inline-block text-[#c47a2c] underline"
                    >
                      去入库
                    </Link>
                    <Link
                      href={`/inventory/color/${hexToPathParam(hexKey)}`}
                      className="mt-1 ml-2 inline-block text-[#8a6a4a] underline"
                    >
                      批次
                    </Link>
                  </div>
                ) : null}
              </div>
            );
          })}
      </div>
    </aside>
  );
}
