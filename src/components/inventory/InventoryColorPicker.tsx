'use client';

import { useMemo, useState } from 'react';
import { searchBeadColors } from '@/domain/inventory';
import { getDisplayColorKey, type ColorSystem } from '@/domain/palette';
import { ColorSwatch } from '@/components/ui/ColorSwatch';

type Props = {
  colorSystem: ColorSystem;
  value: string | null;
  onChange: (hex: string) => void;
  placeholder?: string;
};

/** 搜索色号并点选（含相近色） */
export function InventoryColorPicker({
  colorSystem,
  value,
  onChange,
  placeholder = '搜索色号或 hex',
}: Props) {
  const [query, setQuery] = useState('');

  const { matches, near } = useMemo(
    () => searchBeadColors(query, colorSystem),
    [query, colorSystem],
  );

  const pick = (hex: string) => {
    onChange(hex);
    setQuery('');
  };

  return (
    <div className="space-y-2">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        className="h-11 w-full rounded-xl border border-[#eadfce] bg-[#fffaf3] px-3 text-sm text-[#3a2416] placeholder:text-[#b09a80] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e8b86a]"
      />
      {value ? (
        <div className="flex items-center gap-2 text-sm text-[#5c4030]">
          <ColorSwatch hex={value} size="sm" />
          <span className="font-mono font-medium">{getDisplayColorKey(value, colorSystem)}</span>
          <span className="text-xs text-[#8a6a4a]">{value}</span>
          <button
            type="button"
            className="ml-auto text-xs text-[#8a6a4a] underline"
            onClick={() => onChange('')}
          >
            清除
          </button>
        </div>
      ) : null}
      {matches.length > 0 ? (
        <ul className="max-h-40 overflow-y-auto rounded-xl border border-[#eadfce] bg-white divide-y divide-[#f0e6d8]">
          {matches.map((color) => (
            <li key={color.hex}>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-[#fff4e6]"
                onClick={() => pick(color.hex)}
              >
                <ColorSwatch hex={color.hex} size="sm" />
                <span className="font-mono font-medium text-[#3a2416]">{color.displayKey}</span>
                <span className="text-xs text-[#8a6a4a]">{color.hex}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {near.length > 0 ? (
        <div>
          <p className="mb-1 text-[11px] font-medium text-[#8a6a4a]">相近色</p>
          <ul className="max-h-40 overflow-y-auto rounded-xl border border-[#eadfce] bg-[#fff4e6] divide-y divide-[#f0e6d8]">
            {near.map((color) => (
              <li key={color.hex}>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-[#f3e6d4]"
                  onClick={() => pick(color.hex)}
                >
                  <ColorSwatch hex={color.hex} size="sm" />
                  <span className="font-mono font-medium text-[#3a2416]">{color.displayKey}</span>
                  <span className="text-xs text-[#8a6a4a]">{color.hex}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {query.trim() && matches.length === 0 && near.length === 0 ? (
        <p className="text-xs text-[#8a6a4a]">没有匹配的色号，试试完整 hex（如 FFCCDDEE 去掉 #）</p>
      ) : null}
    </div>
  );
}
