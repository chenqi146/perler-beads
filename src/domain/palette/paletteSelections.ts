/**
 * 色板选择纯逻辑（无 localStorage）。
 */

export interface PaletteSelections {
  [hexValue: string]: boolean;
}

/**
 * 将预设色板转换为选择状态对象（基于 hex 值）
 */
export function presetToSelections(
  allHexValues: string[],
  presetHexValues: string[],
): PaletteSelections {
  const presetSet = new Set(presetHexValues.map((hex) => hex.toUpperCase()));
  const selections: PaletteSelections = {};

  allHexValues.forEach((hex) => {
    const normalizedHex = hex.toUpperCase();
    selections[normalizedHex] = presetSet.has(normalizedHex);
  });

  return selections;
}

/**
 * 根据 MARD 色号预设生成基于 hex 值的选择状态（用于兼容旧预设）
 */
export function presetKeysToHexSelections(
  allBeadPalette: Array<{ key: string; hex: string }>,
  presetKeys: string[],
): PaletteSelections {
  const presetKeySet = new Set(presetKeys);
  const selections: PaletteSelections = {};
  const processedHexValues = new Set<string>();

  console.log(
    `presetKeysToHexSelections: 输入调色板大小 ${allBeadPalette.length}, 预设键数量 ${presetKeys.length}`,
  );

  allBeadPalette.forEach((color) => {
    const normalizedHex = color.hex.toUpperCase();

    if (processedHexValues.has(normalizedHex)) {
      console.warn(`重复的hex值: ${normalizedHex}, MARD键: ${color.key}`);
      return;
    }

    processedHexValues.add(normalizedHex);
    selections[normalizedHex] = presetKeySet.has(color.key);
  });

  const selectedCount = Object.values(selections).filter(Boolean).length;
  console.log(
    `presetKeysToHexSelections: 生成选择对象，总数 ${Object.keys(selections).length}, 选中 ${selectedCount}`,
  );

  return selections;
}
