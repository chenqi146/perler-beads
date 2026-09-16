'use client';

import { getColorKeyByHex, type ColorSystem } from '../../domain/palette';

export type EditorColorStripProps = {
  sortedColors: string[];
  colorCounts: Record<string, { count: number; color: string }> | null | undefined;
  colorSystem: ColorSystem;
  highlightHex: string | null;
  /** 点击：高亮并按色全选 */
  onSelectColor: (hex: string) => void;
};

/** 编辑页移动端底栏色带：点色号按色全选 */
export function EditorColorStrip({
  sortedColors,
  colorCounts,
  colorSystem,
  highlightHex,
  onSelectColor,
}: EditorColorStripProps) {
  return (
    <div
      className="flex gap-2 overflow-x-auto overscroll-x-contain px-1 py-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      role="listbox"
      aria-label="按色选择"
    >
      {sortedColors.map((hex) => {
        const color = colorCounts?.[hex]?.color ?? hex;
        const displayKey = getColorKeyByHex(hex, colorSystem);
        const count = colorCounts?.[hex]?.count ?? 0;
        const active = highlightHex?.toUpperCase() === hex.toUpperCase();

        return (
          <button
            key={hex}
            type="button"
            role="option"
            aria-selected={active}
            aria-label={`选择全部 ${displayKey}（${count}）`}
            onClick={() => onSelectColor(hex)}
            className={[
              'flex h-14 min-w-[3.25rem] shrink-0 touch-manipulation flex-col items-center justify-center gap-0.5 rounded-xl border px-2 transition-[background-color,border-color] duration-150',
              active ? 'border-[#c47a2c] bg-[#fff4e6]' : 'border-[#eadfce] bg-white',
            ].join(' ')}
          >
            <span
              className="h-5 w-5 rounded-md border border-black/10"
              style={{ backgroundColor: color }}
              aria-hidden="true"
            />
            <span className="max-w-[3rem] truncate font-mono text-[10px] leading-tight text-[#3a2416]">
              {displayKey}
            </span>
            <span className="text-[9px] tabular-nums text-[#8a6a4a]">{count}</span>
          </button>
        );
      })}
    </div>
  );
}
