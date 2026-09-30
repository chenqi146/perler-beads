import { colorDistance, type RgbColor } from '../pixelation/pixelation';
import { fullBeadPalette, getDisplayColorKey, type ColorSystem } from '../palette';

export type ColorSearchHit = {
  hex: string;
  displayKey: string;
  kind: 'exact' | 'prefix' | 'includes' | 'near';
};

/** 规范化搜色输入：去空格、大写、补 # */
export function normalizeColorQuery(raw: string): string {
  return String(raw || '')
    .trim()
    .replace(/\s+/g, '')
    .toUpperCase();
}

function hexToRgbSafe(hex: string): RgbColor | null {
  const m = /^#?([0-9A-F]{6})$/i.exec(hex);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/**
 * 搜色：精确 / 前缀 / 包含；无匹配时按 RGB 距离给相近色 Top N
 */
export function searchBeadColors(
  query: string,
  colorSystem: ColorSystem,
  options: { limit?: number; nearLimit?: number } = {},
): { matches: ColorSearchHit[]; near: ColorSearchHit[] } {
  const limit = options.limit ?? 24;
  const nearLimit = options.nearLimit ?? 5;
  const q = normalizeColorQuery(query);
  if (!q) return { matches: [], near: [] };

  const exact: ColorSearchHit[] = [];
  const prefix: ColorSearchHit[] = [];
  const includes: ColorSearchHit[] = [];

  for (const color of fullBeadPalette) {
    const displayKey = getDisplayColorKey(color.hex, colorSystem);
    const keyU = displayKey.toUpperCase();
    const hexU = color.hex.toUpperCase();
    const hit = (kind: ColorSearchHit['kind']): ColorSearchHit => ({
      hex: color.hex,
      displayKey,
      kind,
    });

    if (keyU === q || hexU === q || hexU === `#${q}` || keyU.replace(/^#/, '') === q) {
      exact.push(hit('exact'));
    } else if (keyU.startsWith(q) || hexU.startsWith(q) || hexU.startsWith(`#${q}`)) {
      prefix.push(hit('prefix'));
    } else if (keyU.includes(q) || hexU.includes(q)) {
      includes.push(hit('includes'));
    }
  }

  const matches = [...exact, ...prefix, ...includes].slice(0, limit);
  if (matches.length > 0) {
    return { matches, near: [] };
  }

  // 尝试把查询当 hex 算相近色；否则用第一个「看起来像色」失败时仍可用 query 的 hash 近似——改为：无有效 rgb 则 empty near
  let targetRgb = hexToRgbSafe(q.startsWith('#') ? q : `#${q}`);
  if (!targetRgb && /^\d+$/.test(q)) {
    // 纯数字色号无 hex：不硬猜，返回空相近
    return { matches: [], near: [] };
  }
  if (!targetRgb) {
    // 用查询字符串在 palette 里找不到时，尝试取 query 中嵌入的 hex 片段
    const embedded = q.match(/[0-9A-F]{6}/);
    targetRgb = embedded ? hexToRgbSafe(`#${embedded[0]}`) : null;
  }
  if (!targetRgb) {
    return { matches: [], near: [] };
  }

  const scored = fullBeadPalette
    .map((color) => ({
      hex: color.hex,
      displayKey: getDisplayColorKey(color.hex, colorSystem),
      dist: colorDistance(targetRgb!, color.rgb),
    }))
    .sort((a, b) => a.dist - b.dist)
    .slice(0, nearLimit)
    .map(
      (row): ColorSearchHit => ({
        hex: row.hex,
        displayKey: row.displayKey,
        kind: 'near',
      }),
    );

  return { matches: [], near: scored };
}
