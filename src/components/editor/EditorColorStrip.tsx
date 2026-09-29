'use client';

import { getColorKeyByHex, type ColorSystem } from '../../domain/palette';

export type EditorColorStripProps = {
  sortedColors: string[];
  colorCounts: Record<string, { count: number; color: string }> | null | undefined;
  colorSystem: ColorSystem;
  highlightHex: string | null;
  /** 点击：高亮并按色全选（不打开改色弹窗） */
  onSelectColor: (hex: string) => void;
};

/** 编辑页移动端底栏色带：点色号按色全选，再点「改色」打开面板 */
export function EditorColorStrip({
  sortedColors,
  colorCounts,
  colorSystem,
  highlightHex,
  onSelectColor,
}: EditorColorStripProps) {
  return (
    <div
      className="flex gap-1.5 overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
              'inline-flex h-9 shrink-0 touch-manipulation items-center gap-1.5 rounded-lg border px-2 transition-[background-color,border-color] duration-150',
              active
                ? 'border-[#c47a2c] bg-[#fff4e6]'
                : 'border-[#eadfce] bg-white active:bg-[#f8f1e6]',
            ].join(' ')}
          >
            <span
              className="h-4 w-4 shrink-0 rounded-[3px] border border-black/10"
              style={{ backgroundColor: color }}
              aria-hidden="true"
            />
            <span className="font-mono text-[11px] font-semibold leading-none text-[#3a2416]">
              {displayKey}
            </span>
            <span className="text-[10px] tabular-nums leading-none text-[#a08060]">{count}</span>
          </button>
        );
      })}
    </div>
  );
}
