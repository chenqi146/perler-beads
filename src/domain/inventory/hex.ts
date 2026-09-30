import { getAllHexValues } from '../palette/colorSystemUtils';
import type { ColorSystem } from '../palette/colorSystemUtils';
import { convertColorKeyToHex } from '../palette/colorSystemUtils';

const paletteHexSet = new Set(getAllHexValues().map((h) => h.toUpperCase()));

/** 规范化为 #RRGGBB 大写；非法返回 null */
export function normalizeInventoryHex(raw: string): string | null {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return null;
  let hex = trimmed.toUpperCase();
  if (!hex.startsWith('#')) {
    if (/^[0-9A-F]{6}$/.test(hex)) hex = `#${hex}`;
    else return null;
  }
  if (!/^#[0-9A-F]{6}$/.test(hex)) return null;
  if (!paletteHexSet.has(hex)) return null;
  return hex;
}

/** 色号或 hex → 调色板 hex；失败返回 null */
export function resolveInventoryHex(
  colorKeyOrHex: string,
  colorSystem: ColorSystem,
): string | null {
  const asHex = normalizeInventoryHex(colorKeyOrHex);
  if (asHex) return asHex;
  const converted = convertColorKeyToHex(String(colorKeyOrHex || '').trim(), colorSystem);
  return normalizeInventoryHex(converted);
}

export function isPaletteHex(hex: string): boolean {
  return paletteHexSet.has(hex.toUpperCase());
}

/** URL 段：去掉 # */
export function hexToPathParam(hex: string): string {
  return hex.replace(/^#/, '').toUpperCase();
}

export function pathParamToHex(param: string): string | null {
  return normalizeInventoryHex(param);
}
