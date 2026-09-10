import { MappedPixel, ColorSystem } from './pixelation';
import { getDisplayColorKey, getColorKeyByHex } from './colorSystemUtils';
import { TRANSPARENT_KEY } from './pixelEditingUtils';

export type BeadSize = 'standard' | 'mini';

export interface IngredientItem {
  colorKey: string;
  hexCode: string;
  beadCount: number;
  suggestedCount: number;
  estimatedWeight: number;
}

export interface IngredientBill {
  gridSize: { cols: number; rows: number };
  totalBeads: number;
  colorCount: number;
  beadSize: BeadSize;
  wasteRatio: number;
  items: IngredientItem[];
}

const GRAMS_PER_BEAD: Record<BeadSize, number> = {
  standard: 0.052,
  mini: 0.012,
};

export function generateIngredientBill(
  grid: MappedPixel[][],
  colorSystem: ColorSystem,
  gridSize: { cols: number; rows: number },
  options: { beadSize?: BeadSize; wasteRatio?: number } = {},
): IngredientBill {
  const beadSize = options.beadSize ?? 'standard';
  const wasteRatio = Math.max(1, options.wasteRatio ?? 1.2);
  const counts = new Map<string, { color: string; count: number }>();

  for (const row of grid) {
    for (const cell of row) {
      if (!cell || cell.isExternal || cell.key === TRANSPARENT_KEY) continue;
      const hex = cell.color.toUpperCase();
      const current = counts.get(hex);
      counts.set(hex, { color: cell.color, count: (current?.count ?? 0) + 1 });
    }
  }

  const items = [...counts.entries()]
    .sort(([a], [b]) => getColorKeyByHex(a, colorSystem).localeCompare(getColorKeyByHex(b, colorSystem)))
    .map(([hex, item]) => ({
      colorKey: getDisplayColorKey(hex, colorSystem),
      hexCode: hex,
      beadCount: item.count,
      suggestedCount: Math.ceil(item.count * wasteRatio),
      estimatedWeight: Math.round(item.count * GRAMS_PER_BEAD[beadSize] * 100) / 100,
    }));

  return {
    gridSize,
    totalBeads: items.reduce((sum, item) => sum + item.beadCount, 0),
    colorCount: items.length,
    beadSize,
    wasteRatio,
    items,
  };
}

export function exportIngredientCsv(bill: IngredientBill): void {
  const lines = [
    ['图纸尺寸', `${bill.gridSize.cols}x${bill.gridSize.rows}`],
    ['总粒数', bill.totalBeads],
    ['颜色数', bill.colorCount],
    ['拼豆规格', bill.beadSize === 'mini' ? 'Mini' : 'Standard'],
    ['损耗系数', bill.wasteRatio],
    [],
    ['色号', 'Hex', '图纸用量', '建议购买量', '理论重量(g)'],
    ...bill.items.map(item => [item.colorKey, item.hexCode, item.beadCount, item.suggestedCount, item.estimatedWeight]),
  ];
  const csv = lines.map(row => row.map(value => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'perler-beads-ingredient-list.csv';
  link.click();
  URL.revokeObjectURL(url);
}
