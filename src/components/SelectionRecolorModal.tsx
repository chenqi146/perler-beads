'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { PaletteColor } from '../utils/pixelation';
import { ColorSystem, getDisplayColorKey } from '../utils/colorSystemUtils';
import { TRANSPARENT_KEY } from '../utils/pixelEditingUtils';
import { CloseIcon, IconButton } from './ui/IconButton';
import { Overlay } from './ui/Overlay';

type ColorPick = { key: string; color: string };

function groupColorsByPrefix(
  colors: PaletteColor[],
  selectedColorSystem: ColorSystem
): Record<string, PaletteColor[]> {
  const groups: Record<string, PaletteColor[]> = {};

  colors.forEach((color) => {
    const displayKey = getDisplayColorKey(color.hex, selectedColorSystem);
    let prefix: string;

    if (selectedColorSystem === '盼盼' || selectedColorSystem === '咪小窝') {
      if (/^\d+$/.test(displayKey)) {
        const num = parseInt(displayKey, 10);
        if (num <= 20) prefix = '1-20';
        else if (num <= 50) prefix = '21-50';
        else if (num <= 100) prefix = '51-100';
        else if (num <= 200) prefix = '101-200';
        else prefix = '200+';
      } else {
        prefix = '其他';
      }
    } else {
      prefix = displayKey.match(/^[A-Z]+/)?.[0] || '其他';
    }

    if (!groups[prefix]) groups[prefix] = [];
    groups[prefix].push(color);
  });

  Object.keys(groups).forEach((prefix) => {
    groups[prefix].sort((a, b) => {
      const keyA = getDisplayColorKey(a.hex, selectedColorSystem);
      const keyB = getDisplayColorKey(b.hex, selectedColorSystem);
      if (selectedColorSystem === '盼盼' || selectedColorSystem === '咪小窝') {
        return (parseInt(keyA, 10) || 0) - (parseInt(keyB, 10) || 0);
      }
      const numA = parseInt(keyA.replace(/^[A-Z]+/, ''), 10) || 0;
      const numB = parseInt(keyB.replace(/^[A-Z]+/, ''), 10) || 0;
      return numA - numB;
    });
  });

  return groups;
}

function sortPrefixKeys(keys: string[], colorSystem: ColorSystem): string[] {
  if (colorSystem === '盼盼' || colorSystem === '咪小窝') {
    const order = ['1-20', '21-50', '51-100', '101-200', '200+', '其他'];
    return [...keys].sort((a, b) => order.indexOf(a) - order.indexOf(b));
  }
  return [...keys].sort((a, b) => {
    if (a === '其他') return 1;
    if (b === '其他') return -1;
    return a.localeCompare(b);
  });
}

interface SelectionRecolorModalProps {
  selectedCount: number;
  allColors: PaletteColor[];
  /** 图纸上已使用的颜色（置顶快捷区） */
  usedColors?: { key: string; color: string }[];
  selectedColorSystem: ColorSystem;
  onPick: (color: ColorPick) => void;
  onClose: () => void;
  /** floating=桌面浮层；sheet=移动端底部面板 */
  variant?: 'floating' | 'sheet';
}

const SelectionRecolorModal: React.FC<SelectionRecolorModalProps> = ({
  selectedCount,
  allColors,
  usedColors = [],
  selectedColorSystem,
  onPick,
  onClose,
  variant = 'floating',
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('全部');
  const [pendingColor, setPendingColor] = useState<ColorPick | null>(null);
  const staged = variant === 'sheet';

  const filteredColors = useMemo(() => {
    if (!searchTerm.trim()) return allColors;
    const q = searchTerm.trim().toLowerCase();
    return allColors.filter((color) => {
      const displayKey = getDisplayColorKey(color.hex, selectedColorSystem).toLowerCase();
      const hex = color.hex.toLowerCase();
      const mard = color.key.toLowerCase();
      return displayKey.includes(q) || hex.includes(q) || mard.includes(q);
    });
  }, [allColors, searchTerm, selectedColorSystem]);

  const colorGroups = useMemo(
    () => groupColorsByPrefix(filteredColors, selectedColorSystem),
    [filteredColors, selectedColorSystem]
  );

  const categoryKeys = useMemo(
    () => sortPrefixKeys(Object.keys(colorGroups), selectedColorSystem),
    [colorGroups, selectedColorSystem]
  );

  useEffect(() => {
    if (activeCategory !== '全部' && !categoryKeys.includes(activeCategory)) {
      setActiveCategory('全部');
    }
  }, [activeCategory, categoryKeys]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onClose();
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [onClose]);

  const visibleColors = useMemo(() => {
    if (activeCategory === '全部') return filteredColors;
    return colorGroups[activeCategory] || [];
  }, [activeCategory, filteredColors, colorGroups]);

  const pick = (next: ColorPick) => {
    if (staged) setPendingColor(next);
    else onPick(next);
  };

  const categoryChip = (label: string, count: number, active: boolean, onClick: () => void) => (
    <button
      key={label}
      type="button"
      onClick={onClick}
      className={`shrink-0 touch-manipulation rounded-md border px-2.5 py-1.5 text-[12px] font-medium tabular-nums transition-colors ${
        active
          ? 'border-[#c47a2c] bg-[#c47a2c] text-white'
          : 'border-[#eadfce] bg-white text-[#5c4030] active:bg-[#f8f1e6]'
      }`}
    >
      {label}
      <span className={active ? 'ml-1 text-white/80' : 'ml-1 text-[#a08060]'}>{count}</span>
    </button>
  );

  const colorCell = (hex: string, displayKey: string, opts?: { used?: boolean }) => {
    const isPending = pendingColor?.color.toUpperCase() === hex;
    return (
      <button
        key={`${opts?.used ? 'used-' : ''}${hex}`}
        type="button"
        title={`${displayKey} · ${hex}`}
        onClick={() => pick({ key: hex, color: hex })}
        className={`flex min-h-0 min-w-0 touch-manipulation flex-col overflow-hidden rounded-md border bg-white text-left transition-[border-color,box-shadow] ${
          isPending
            ? 'border-[#c47a2c] shadow-[0_0_0_2px_rgba(232,184,106,0.55)]'
            : opts?.used
              ? 'border-[#d8c4a8]'
              : 'border-[#eadfce]'
        }`}
      >
        <span className="aspect-[4/3] w-full border-b border-black/5" style={{ backgroundColor: hex }} />
        <span className="truncate px-1 py-1 text-center font-mono text-[10px] font-semibold leading-none text-[#3a2416]">
          {displayKey}
        </span>
      </button>
    );
  };

  const panel = (
    <>
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[#eadfce] px-4 pb-3 pt-3.5">
        <div className="min-w-0">
          <div className="mx-auto mb-2.5 h-1 w-9 rounded-full bg-[#e0d0bc] lg:hidden" aria-hidden="true" />
          <h3 id="selection-recolor-title" className="text-[15px] font-semibold tracking-tight text-[#3a2416]">
            统一改色
          </h3>
          <p className="mt-0.5 text-[12px] text-[#8a6a4a]">
            已选 {selectedCount} 格
            {staged ? ' · 选色后点应用' : ' · 点色号立即应用'}
          </p>
        </div>
        <IconButton
          aria-label="关闭"
          onClick={onClose}
          className="shrink-0 text-[#5c4030] hover:bg-[#f3e6d4] hover:text-[#3a2416]"
        >
          <CloseIcon />
        </IconButton>
      </div>

      <div className="shrink-0 space-y-2.5 border-b border-[#eadfce] px-4 py-3">
        <div className="relative">
          <label htmlFor="selection-recolor-search" className="sr-only">
            搜索色号
          </label>
          <input
            id="selection-recolor-search"
            type="search"
            name="color-search"
            autoComplete="off"
            spellCheck={false}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={`搜索 ${selectedColorSystem} 色号或 HEX`}
            className="h-10 w-full rounded-lg border border-[#eadfce] bg-white pl-9 pr-3 text-sm text-[#3a2416] placeholder:text-[#b09070] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e8b86a]"
          />
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-[#b09070]">
            ⌕
          </span>
        </div>

        <div className="flex gap-1.5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {categoryChip('全部', filteredColors.length, activeCategory === '全部', () =>
            setActiveCategory('全部')
          )}
          {categoryKeys.map((prefix) =>
            categoryChip(prefix, colorGroups[prefix]?.length || 0, activeCategory === prefix, () =>
              setActiveCategory(prefix)
            )
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-3">
        {usedColors.length > 0 && !searchTerm && activeCategory === '全部' && (
          <div>
            <p className="mb-2 text-[11px] font-medium tracking-wide text-[#8a6a4a]">图纸已用色</p>
            <div className="grid grid-cols-5 gap-2 sm:grid-cols-6 md:grid-cols-8">
              {usedColors.map((c) => {
                const hex = c.color.toUpperCase();
                return colorCell(hex, c.key, { used: true });
              })}
            </div>
          </div>
        )}

        <div>
          <p className="mb-2 text-[11px] font-medium tracking-wide text-[#8a6a4a]">
            {activeCategory === '全部' ? '全部色号' : `${activeCategory} 系列`}
            <span className="ml-1 text-[#b09070]">({visibleColors.length})</span>
          </p>
          {visibleColors.length === 0 ? (
            <p className="py-10 text-center text-sm text-[#a08060]">没有匹配的颜色</p>
          ) : (
            <div className="grid grid-cols-5 gap-2 sm:grid-cols-6 md:grid-cols-8">
              {visibleColors.map((color) => {
                const hex = color.hex.toUpperCase();
                const displayKey = getDisplayColorKey(color.hex, selectedColorSystem);
                return colorCell(hex, displayKey);
              })}
            </div>
          )}
        </div>
      </div>

      <div
        className="flex shrink-0 items-center justify-between gap-2 border-t border-[#eadfce] bg-[#fffaf3] px-4 py-3"
        style={{
          paddingBottom:
            variant === 'sheet' ? 'max(0.75rem, env(safe-area-inset-bottom))' : undefined,
        }}
      >
        <button
          type="button"
          title="擦除为透明"
          onClick={() => pick({ key: TRANSPARENT_KEY, color: '#FFFFFF' })}
          className={`h-10 touch-manipulation rounded-lg border border-dashed px-3 text-xs font-medium ${
            pendingColor?.key === TRANSPARENT_KEY
              ? 'border-red-400 bg-red-50 text-red-700'
              : 'border-red-300 bg-white text-red-600'
          }`}
        >
          擦除
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-10 touch-manipulation rounded-lg border border-[#eadfce] bg-white px-4 text-sm font-medium text-[#5c4030]"
          >
            取消
          </button>
          {staged ? (
            <button
              type="button"
              disabled={!pendingColor}
              onClick={() => pendingColor && onPick(pendingColor)}
              className="h-10 min-w-[7.5rem] touch-manipulation rounded-lg bg-[#c47a2c] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {pendingColor ? `应用到 ${selectedCount} 格` : '选择颜色'}
            </button>
          ) : null}
        </div>
      </div>
    </>
  );

  if (variant === 'sheet') {
    return (
      <Overlay labelledBy="selection-recolor-title" placement="sheet" onClose={onClose}>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{panel}</div>
      </Overlay>
    );
  }

  return (
    <div className="fixed top-3 left-3 z-[280] flex justify-start" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="selection-recolor-title"
        className="flex w-[min(92vw,360px)] max-h-[min(62vh,460px)] flex-col overflow-hidden overscroll-contain rounded-xl border border-[#eadfce] bg-[#fffaf3] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {panel}
      </div>
    </div>
  );
};

export default SelectionRecolorModal;
