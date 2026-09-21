import type { PaletteSelections } from '../../domain/palette/paletteSelections';
import { fullBeadPalette } from '../../domain/palette/fullBeadPalette';
import {
  selectionsFromPreset,
  DEFAULT_PALETTE_PRESET_ID,
} from '../../domain/palette/palettePresets';

const STORAGE_KEY = 'customPerlerPaletteSelections';

/**
 * 保存自定义色板选择状态到 localStorage
 */
export function savePaletteSelections(selections: PaletteSelections): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(selections));
  } catch (error) {
    console.error('无法保存色板选择到本地存储:', error);
  }
}

/**
 * 从 localStorage 加载自定义色板选择状态
 */
export function loadPaletteSelections(): PaletteSelections | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('无法从本地存储加载色板选择:', error);
    localStorage.removeItem(STORAGE_KEY);
  }
  return null;
}

/**
 * 解析可用色板选择：优先 localStorage 有效项，否则默认预设。
 * 仅在浏览器端调用。
 */
export function resolvePaletteSelections(): PaletteSelections {
  const allHexValues = fullBeadPalette.map((color) => color.hex.toUpperCase());
  const hexSet = new Set(allHexValues);
  const saved = loadPaletteSelections();

  if (saved && Object.keys(saved).length > 0) {
    const valid: PaletteSelections = {};
    let selectedCount = 0;
    for (const hex of allHexValues) {
      const on = saved[hex] === true;
      valid[hex] = on;
      if (on) selectedCount++;
    }
    // 若旧数据键全无效，退回默认预设
    const hadAnyRecognized = Object.keys(saved).some((k) => hexSet.has(k.toUpperCase()));
    if (hadAnyRecognized && selectedCount > 0) {
      return valid;
    }
    if (hadAnyRecognized && selectedCount === 0) {
      // 用户确实全不选：保留空选（色板页允许），但编辑器应提示而不是假装未加载
      return valid;
    }
  }

  return selectionsFromPreset(DEFAULT_PALETTE_PRESET_ID);
}
