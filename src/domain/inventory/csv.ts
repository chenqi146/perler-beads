import type { ColorSystem } from '../palette/colorSystemUtils';
import { colorSystemOptions } from '../palette/colorSystemUtils';
import { normalizeInventoryHex, resolveInventoryHex } from './hex';
import type { InboundLineInput } from './types';

export type CsvParseResult = {
  lines: InboundLineInput[];
  errors: string[];
};

const VALID_SYSTEMS = new Set(colorSystemOptions.map((o) => o.key));

/**
 * 解析入库 CSV，兼容：
 * 1) 色号或Hex, 数量, 备注(可选)
 * 2) 品牌,编号,数量,颜色,状态,添加时间（外部导出常见格式）
 */
export function parseInboundCsv(
  text: string,
  colorSystem: ColorSystem,
): CsvParseResult {
  const errors: string[] = [];
  const lines: InboundLineInput[] = [];
  const rawLines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (rawLines.length === 0) {
    return { lines: [], errors: ['CSV 为空'] };
  }

  const firstCols = splitCsvRow(rawLines[0]);
  const headerMap = detectHeaderMap(firstCols);
  const dataStart = headerMap ? 1 : 0;

  for (let index = dataStart; index < rawLines.length; index++) {
    const cols = splitCsvRow(rawLines[index]);
    const rowNo = index + 1;

    if (headerMap) {
      const parsed = parseNamedRow(cols, headerMap, colorSystem, rowNo);
      if (parsed.error) {
        if (parsed.error !== 'skip') errors.push(parsed.error);
        continue;
      }
      if (parsed.line) lines.push(parsed.line);
      continue;
    }

    if (cols.length < 2) {
      errors.push(`第 ${rowNo} 行：列数不足`);
      continue;
    }
    if (index === 0 && looksLikeSimpleHeader(cols[0], cols[1])) {
      continue;
    }

    const [keyRaw, qtyRaw, noteRaw] = cols;
    const hex = resolveInventoryHex(keyRaw, colorSystem);
    if (!hex) {
      errors.push(`第 ${rowNo} 行：无法识别色号「${keyRaw}」`);
      continue;
    }
    const quantity = parseQty(qtyRaw);
    if (quantity == null) {
      errors.push(`第 ${rowNo} 行：数量无效`);
      continue;
    }
    lines.push({
      hex,
      quantity,
      note: noteRaw ? String(noteRaw).trim() : undefined,
    });
  }

  return { lines, errors };
}

type HeaderMap = {
  brand?: number;
  key?: number;
  qty: number;
  hex?: number;
  status?: number;
  time?: number;
};

function detectHeaderMap(cols: string[]): HeaderMap | null {
  const normalized = cols.map((c) => c.trim().toLowerCase());
  const find = (...names: string[]) => {
    for (let i = 0; i < normalized.length; i++) {
      const cell = normalized[i];
      if (names.some((n) => cell === n || cell.includes(n))) return i;
    }
    return -1;
  };

  const brand = find('品牌', 'brand');
  const key = find('编号', '色号', 'code', 'key');
  const qty = find('数量', 'quantity', 'count', 'qty');
  const hex = find('颜色', 'hex', '色值');
  const status = find('状态', 'status');
  const time = find('添加时间', '时间', 'time', 'date');

  // 外部格式：至少有数量，且有编号或颜色
  if (qty >= 0 && (key >= 0 || hex >= 0) && (brand >= 0 || hex >= 0 || key >= 0)) {
    // 避免把简单「色号,数量」误判成 named：若只有两列且无品牌/颜色列名，走简单格式
    if (cols.length <= 2 && brand < 0 && hex < 0) return null;
    if (brand >= 0 || (key >= 0 && hex >= 0) || normalized.some((c) => c.includes('品牌') || c.includes('编号'))) {
      return {
        brand: brand >= 0 ? brand : undefined,
        key: key >= 0 ? key : undefined,
        qty,
        hex: hex >= 0 ? hex : undefined,
        status: status >= 0 ? status : undefined,
        time: time >= 0 ? time : undefined,
      };
    }
  }

  // 表头含「品牌」+「编号」+「数量」
  if (brand >= 0 && key >= 0 && qty >= 0) {
    return {
      brand,
      key,
      qty,
      hex: hex >= 0 ? hex : undefined,
      status: status >= 0 ? status : undefined,
      time: time >= 0 ? time : undefined,
    };
  }

  return null;
}

function parseNamedRow(
  cols: string[],
  map: HeaderMap,
  fallbackSystem: ColorSystem,
  rowNo: number,
): { line?: InboundLineInput; error?: string } {
  if (map.status != null) {
    const status = (cols[map.status] || '').trim();
    if (status && status !== '启用' && !/^(1|true|yes|on|active)$/i.test(status)) {
      return { error: 'skip' };
    }
  }

  const qtyRaw = cols[map.qty];
  const quantity = parseQty(qtyRaw);
  if (quantity == null) {
    return { error: `第 ${rowNo} 行：数量无效` };
  }

  let hex: string | null = null;
  if (map.hex != null && cols[map.hex]) {
    hex = normalizeInventoryHex(cols[map.hex]);
  }

  const brandRaw = map.brand != null ? (cols[map.brand] || '').trim() : '';
  const keyRaw = map.key != null ? (cols[map.key] || '').trim() : '';
  const system = resolveBrandSystem(brandRaw) || fallbackSystem;

  if (!hex && keyRaw) {
    hex = resolveInventoryHex(keyRaw, system);
    // A01 ↔ A1 容错
    if (!hex && /^[A-Za-z]+\d+$/.test(keyRaw)) {
      const stripped = keyRaw.replace(/^([A-Za-z]+)0+(\d+)$/, '$1$2');
      if (stripped !== keyRaw) hex = resolveInventoryHex(stripped, system);
    }
  }

  if (!hex) {
    return {
      error: `第 ${rowNo} 行：无法识别颜色「${keyRaw || cols[map.hex ?? -1] || ''}」`,
    };
  }

  const noteParts: string[] = [];
  if (keyRaw) noteParts.push(keyRaw);
  if (map.time != null && cols[map.time]) noteParts.push(String(cols[map.time]).trim());

  return {
    line: {
      hex,
      quantity,
      note: noteParts.length ? noteParts.join(' · ') : undefined,
    },
  };
}

function resolveBrandSystem(brand: string): ColorSystem | null {
  const b = brand.trim().toUpperCase();
  if (!b) return null;
  for (const opt of colorSystemOptions) {
    if (opt.key.toUpperCase() === b || opt.name.toUpperCase() === b) {
      return opt.key as ColorSystem;
    }
  }
  if (VALID_SYSTEMS.has(brand as ColorSystem)) return brand as ColorSystem;
  return null;
}

function parseQty(raw: string | undefined): number | null {
  const quantity = Number.parseInt(String(raw ?? '').replace(/[",\s]/g, ''), 10);
  if (!Number.isFinite(quantity) || quantity <= 0) return null;
  return quantity;
}

function looksLikeSimpleHeader(a: string, b: string): boolean {
  const s = `${a}${b}`.toLowerCase();
  return /色|hex|quantity|数量|count|编号|品牌/.test(s);
}

function splitCsvRow(row: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < row.length; i++) {
    const ch = row[i];
    if (ch === '"') {
      if (inQuotes && row[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  result.push(current.trim());
  return result.map((c) => c.replace(/^"|"$/g, ''));
}

export function exportStockCsv(
  items: { colorKey: string; hex: string; quantity: number; lotCount: number }[],
): string {
  const rows = [
    ['色号', 'Hex', '余量', '批次数'],
    ...items.map((item) => [
      item.colorKey,
      item.hex,
      String(item.quantity),
      String(item.lotCount),
    ]),
  ];
  return rows
    .map((row) => row.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(','))
    .join('\n');
}
