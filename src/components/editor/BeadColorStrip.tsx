'use client';

import { useRef } from 'react';
import { getColorKeyByHex, type ColorSystem } from '../../domain/palette';

export type BeadColorStripProps = {
  sortedColors: string[];
  colorCounts: Record<string, { count: number; color: string }> | null | undefined;
  colorSystem: ColorSystem;
  highlightHex: string | null;
  completedSet: Set<string>;
  cellProgress: Record<string, { done: number; total: number }>;
  justCompleted: string | null;
  onToggleHighlight: (hex: string) => void;
  onToggleComplete: (hex: string, next: boolean) => void;
};

const LONG_PRESS_MS = 480;

/** 移动端底部横向色带：点选高亮，长按整色完成 */
export function BeadColorStrip({
  sortedColors,
  colorCounts,
  colorSystem,
  highlightHex,
  completedSet,
  cellProgress,
  justCompleted,
  onToggleHighlight,
  onToggleComplete,
}: BeadColorStripProps) {
  const longPressTimer = useRef<number | null>(null);
  const longPressFired = useRef(false);

  const clearLongPress = () => {
    if (longPressTimer.current != null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  return (
    <div
      className="flex gap-2 overflow-x-auto overscroll-x-contain px-1 py-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      role="listbox"
      aria-label="颜色列表"
    >
      {sortedColors.map((hex) => {
        const color = colorCounts?.[hex]?.color ?? hex;
        const displayKey = getColorKeyByHex(hex, colorSystem);
        const active = highlightHex?.toUpperCase() === hex.toUpperCase();
        const done = completedSet.has(hex.toUpperCase());
        const pop = justCompleted === hex.toUpperCase();
        const progress = cellProgress[hex.toUpperCase()] ?? cellProgress[hex];
        const doneCells = progress?.done ?? 0;
        const totalCells = progress?.total ?? colorCounts?.[hex]?.count ?? 0;

        return (
          <button
            key={hex}
            type="button"
            role="option"
            aria-selected={active}
            aria-label={`${displayKey} ${doneCells}/${totalCells}${done ? ' 已完成' : ''}`}
            onClick={() => {
              if (longPressFired.current) {
                longPressFired.current = false;
                return;
              }
              onToggleHighlight(hex);
            }}
            onPointerDown={() => {
              longPressFired.current = false;
              clearLongPress();
              longPressTimer.current = window.setTimeout(() => {
                longPressFired.current = true;
                onToggleComplete(hex, !done);
                if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
                  try {
                    navigator.vibrate(12);
                  } catch {
                    // ignore
                  }
                }
              }, LONG_PRESS_MS);
            }}
            onPointerUp={clearLongPress}
            onPointerLeave={clearLongPress}
            onPointerCancel={clearLongPress}
            className={[
              'flex h-14 min-w-[3.25rem] shrink-0 touch-manipulation flex-col items-center justify-center gap-0.5 rounded-xl border px-2 transition-[background-color,border-color,transform,opacity] duration-150',
              active
                ? 'border-[#c47a2c] bg-[#fff4e6] shadow-[0_2px_8px_rgba(196,122,44,0.18)]'
                : 'border-[#eadfce] bg-white',
              done ? 'opacity-55' : '',
              pop ? 'scale-105' : '',
            ].join(' ')}
          >
            <span
              className="h-5 w-5 rounded-md border border-black/10"
              style={{ backgroundColor: color }}
              aria-hidden="true"
            />
            <span
              className={`max-w-[3rem] truncate font-mono text-[10px] leading-tight ${done ? 'line-through text-[#8a6a4a]' : 'text-[#3a2416]'}`}
            >
              {displayKey}
            </span>
            <span className="text-[9px] tabular-nums text-[#8a6a4a]">
              {doneCells}/{totalCells}
            </span>
          </button>
        );
      })}
    </div>
  );
}
