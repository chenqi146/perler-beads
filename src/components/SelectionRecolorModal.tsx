'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { PaletteColor } from '../utils/pixelation';
import { ColorSystem, getDisplayColorKey } from '../utils/colorSystemUtils';
import { TRANSPARENT_KEY } from '../utils/pixelEditingUtils';
import { CloseIcon, IconButton } from './ui/IconButton';

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
}

const SelectionRecolorModal: React.FC<SelectionRecolorModalProps> = ({
  selectedCount,
  allColors,
  usedColors = [],
  selectedColorSystem,
  onPick,
  onClose,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('全部');

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

  const isLight = (hex: string) => /^#([fF]{2}|[eE]{2}|[dD]{2})/.test(hex);

  const renderSwatch = (color: PaletteColor) => {
    const displayKey = getDisplayColorKey(color.hex, selectedColorSystem);
    const hex = color.hex.toUpperCase();
    return (
      <button
        key={hex}
        type="button"
        title={`${displayKey} · ${hex}`}
        onClick={() => onPick({ key: hex, color: hex })}
        className="aspect-square min-w-0 rounded-md border border-gray-300/80 dark:border-gray-600 hover:ring-2 hover:ring-amber-400 text-[10px] font-mono shadow-sm"
        style={{
          backgroundColor: hex,
          color: isLight(hex) ? '#111' : '#fff',
        }}
      >
        {displayKey}
      </button>
    );
  };

  return (
    <div
      className="fixed top-3 left-3 z-[280] flex justify-start"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="selection-recolor-title"
        className="flex w-[min(92vw,360px)] max-h-[min(62vh,460px)] flex-col overflow-hidden overscroll-contain rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-purple-500 text-white shrink-0">
          <div>
            <h3 id="selection-recolor-title" className="text-sm font-semibold">统一改色</h3>
            <p className="text-[11px] text-white/75 mt-0.5">
              已选 {selectedCount} 格 · 选择颜色后立即应用
            </p>
          </div>
          <IconButton aria-label="关闭" onClick={onClose} className="text-white hover:bg-white/20 hover:text-white">
            <CloseIcon />
          </IconButton>
        </div>

        <div className="px-4 pt-2.5 pb-2 space-y-2 shrink-0 border-b border-gray-100 dark:border-gray-700/80">
          <div className="relative">
            <label htmlFor="selection-recolor-search" className="sr-only">搜索色号</label>
            <input
              id="selection-recolor-search"
              type="search"
              name="color-search"
              autoComplete="off"
              spellCheck={false}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={`搜索色号（当前 ${selectedColorSystem}）或 HEX…`}
              className="h-9 w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 text-sm text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">
              ⌕
            </span>
          </div>

          <div className="flex gap-1.5 overflow-x-auto pb-0.5 -mx-0.5 px-0.5">
            <button
              type="button"
              onClick={() => setActiveCategory('全部')}
              className={`shrink-0 h-7 px-2.5 rounded-full text-xs border ${
                activeCategory === '全部'
                  ? 'bg-amber-500 border-amber-500 text-white'
                  : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300'
              }`}
            >
              全部 ({filteredColors.length})
            </button>
            {categoryKeys.map((prefix) => (
              <button
                key={prefix}
                type="button"
                onClick={() => setActiveCategory(prefix)}
                className={`shrink-0 h-7 px-2.5 rounded-full text-xs border ${
                  activeCategory === prefix
                    ? 'bg-amber-500 border-amber-500 text-white'
                    : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300'
                }`}
              >
                {prefix} ({colorGroups[prefix]?.length || 0})
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
          {usedColors.length > 0 && !searchTerm && activeCategory === '全部' && (
            <div>
              <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-2">图纸已用色</p>
              <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-8 md:grid-cols-10">
                {usedColors.map((c) => {
                  const hex = c.color.toUpperCase();
                  return (
                    <button
                      key={`used-${hex}`}
                      type="button"
                      title={`统一改为 ${c.key}`}
                      onClick={() => onPick({ key: hex, color: hex })}
                      className="aspect-square min-w-0 rounded-md border border-blue-300 dark:border-blue-500 hover:ring-2 hover:ring-blue-400 text-[10px] font-mono shadow-sm"
                      style={{
                        backgroundColor: hex,
                        color: isLight(hex) ? '#111' : '#fff',
                      }}
                    >
                      {c.key}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-2">
              {activeCategory === '全部' ? '全部色号' : `${activeCategory} 系列`}
              <span className="ml-1 text-gray-400">({visibleColors.length})</span>
            </p>
            {visibleColors.length === 0 ? (
              <p className="text-sm text-gray-400 py-8 text-center">没有匹配的颜色</p>
            ) : (
              <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-8 md:grid-cols-10">{visibleColors.map(renderSwatch)}</div>
            )}
          </div>
        </div>

        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            title="擦除为透明"
            onClick={() => onPick({ key: TRANSPARENT_KEY, color: '#FFFFFF' })}
            className="h-9 px-3 rounded-lg border border-dashed border-red-300 text-xs text-red-600 bg-white dark:bg-gray-900 hover:bg-red-50"
          >
            擦除选中格
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 rounded-lg border border-gray-300 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-300"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
};

export default SelectionRecolorModal;
