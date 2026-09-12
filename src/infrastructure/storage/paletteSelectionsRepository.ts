import type { PaletteSelections } from '../../domain/palette/paletteSelections';

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
