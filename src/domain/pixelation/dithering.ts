import type { MappedPixel, PaletteColor, RgbColor } from './pixelation';
import { transparentColorData } from './pixelEditingUtils';

export type DitheringMode = 'none' | 'floyd-steinberg';

type CellRgb = RgbColor | null;

const clampByte = (v: number) => Math.max(0, Math.min(255, Math.round(v)));

/**
 * 对已降采样的 N×M 代表色网格做 Floyd–Steinberg 抖动，再映射到色板。
 * 透明格（null）保持透明，不向邻格扩散误差。
 */
export function applyFloydSteinbergDither(
  cells: CellRgb[][],
  palette: PaletteColor[],
  matchFn: (rgb: RgbColor, palette: PaletteColor[]) => PaletteColor,
): MappedPixel[][] {
  const M = cells.length;
  const N = M > 0 ? cells[0].length : 0;
  if (M === 0 || N === 0 || palette.length === 0) {
    return cells.map((row) =>
      row.map((c) =>
        c
          ? { key: palette[0]?.key ?? 'ERR', color: palette[0]?.hex ?? '#000000' }
          : { ...transparentColorData },
      ),
    );
  }

  const buf: (RgbColor | null)[][] = cells.map((row) =>
    row.map((c) => (c ? { r: c.r, g: c.g, b: c.b } : null)),
  );
  const result: MappedPixel[][] = Array.from({ length: M }, () =>
    Array.from({ length: N }, () => ({ ...transparentColorData })),
  );

  const spread = (y: number, x: number, er: number, eg: number, eb: number, factor: number) => {
    if (y < 0 || y >= M || x < 0 || x >= N) return;
    const cell = buf[y][x];
    if (!cell) return;
    cell.r = clampByte(cell.r + er * factor);
    cell.g = clampByte(cell.g + eg * factor);
    cell.b = clampByte(cell.b + eb * factor);
  };

  for (let y = 0; y < M; y++) {
    for (let x = 0; x < N; x++) {
      const old = buf[y][x];
      if (!old) {
        result[y][x] = { ...transparentColorData };
        continue;
      }

      const matched = matchFn(old, palette);
      result[y][x] = { key: matched.key, color: matched.hex };

      const er = old.r - matched.rgb.r;
      const eg = old.g - matched.rgb.g;
      const eb = old.b - matched.rgb.b;

      spread(y, x + 1, er, eg, eb, 7 / 16);
      spread(y + 1, x - 1, er, eg, eb, 3 / 16);
      spread(y + 1, x, er, eg, eb, 5 / 16);
      spread(y + 1, x + 1, er, eg, eb, 1 / 16);
    }
  }

  return result;
}
