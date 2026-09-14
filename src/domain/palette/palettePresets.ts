/**
 * 预设色板（MARD 色号列表）。
 * 291 = 当前全量；221 = 全实色（排除 ZG/Y/Q/P/R 等特殊系列）；其余为历史常用套装。
 */

import { getMardToHexMapping } from './colorSystemUtils';
import { presetToSelections, type PaletteSelections } from './paletteSelections';

/** 历史 168 色（MARD） */
export const PRESET_168_KEYS = [
  'A1', 'B1', 'C1', 'D1', 'E1', 'F1', 'G1', 'M1', 'A2', 'B2', 'C2', 'D2', 'E2', 'F2', 'G2', 'H2', 'M2',
  'A3', 'B3', 'C3', 'D3', 'E3', 'F3', 'G3', 'H3', 'M3', 'A4', 'B4', 'C4', 'D5', 'E4', 'F4', 'G4', 'H4', 'M4',
  'A5', 'B5', 'C5', 'D6', 'E5', 'F5', 'G5', 'H5', 'M5', 'A6', 'B6', 'C6', 'D7', 'E6', 'F6', 'G6', 'H6', 'M6',
  'A7', 'B7', 'C7', 'D8', 'E7', 'F7', 'G7', 'H7', 'M7', 'A8', 'B8', 'C8', 'D9', 'E8', 'F8', 'G8', 'H8', 'M8',
  'A9', 'B10', 'C9', 'D11', 'E9', 'F9', 'G9', 'H9', 'M9', 'A10', 'B11', 'C10', 'D12', 'E10', 'F10', 'G10', 'H10', 'M10',
  'A11', 'B12', 'C11', 'D13', 'E11', 'F11', 'G11', 'H11', 'M11', 'A12', 'B13', 'C13', 'D14', 'E12', 'F12', 'G12', 'H12', 'M12',
  'A13', 'B14', 'C14', 'D15', 'E13', 'F13', 'G13', 'H13', 'M13', 'A14', 'B15', 'C15', 'D16', 'E14', 'F14', 'G14', 'H14', 'M14',
  'A15', 'B16', 'C16', 'D17', 'E15', 'G15', 'M15', 'B17', 'C17', 'D18', 'G16', 'B18', 'D19', 'G17', 'B19', 'D20', 'B20', 'D21', 'T1',
] as const;

/** 历史 144 色（MARD） */
export const PRESET_144_KEYS = [
  'A1', 'B1', 'C1', 'D1', 'E1', 'F1', 'G1', 'H1', 'M1', 'A2', 'B2', 'C2', 'D2', 'E2', 'F2', 'G2', 'H2', 'M2',
  'A3', 'B3', 'C3', 'D3', 'E3', 'F3', 'G3', 'H3', 'M3', 'A4', 'B4', 'C4', 'D5', 'E4', 'F4', 'G4', 'H4', 'M4',
  'A5', 'B5', 'C5', 'D6', 'E5', 'F5', 'G5', 'H5', 'M5', 'A6', 'B6', 'C6', 'D7', 'E6', 'F6', 'G6', 'H6', 'M6',
  'A7', 'B7', 'C7', 'D8', 'E7', 'F7', 'G7', 'H7', 'M7', 'A8', 'B8', 'C8', 'D9', 'E8', 'F8', 'G8', 'H8', 'M8',
  'A9', 'B10', 'C9', 'D11', 'E9', 'F9', 'G9', 'H9', 'M9', 'A10', 'B11', 'C10', 'D12', 'E10', 'F10', 'G10', 'H10', 'M10',
  'A11', 'B12', 'C11', 'D13', 'E11', 'F11', 'G11', 'H11', 'M11', 'A12', 'B13', 'C13', 'D14', 'E12', 'F12', 'G12', 'H12', 'M12',
  'A13', 'B14', 'C14', 'D15', 'E13', 'F13', 'G13', 'H13', 'M13', 'A14', 'B15', 'C15', 'D16', 'E14', 'F14', 'G14', 'H14', 'M14',
  'A15', 'B16', 'C16', 'D17', 'E15', 'G15', 'M15', 'B17', 'C17', 'D18', 'G16', 'B18', 'D19', 'G17', 'B19', 'D20', 'B20', 'D21', 'T1',
] as const;

/** 历史 120 色（MARD） */
export const PRESET_120_KEYS = [
  'A1', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9', 'A10', 'A11', 'A12', 'A13', 'A14', 'A15',
  'B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B10', 'B11', 'B12', 'B13', 'B14', 'B15', 'B16', 'B17', 'B18', 'B19', 'B20',
  'C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'C9', 'C10', 'C11', 'C13', 'C14', 'C15', 'C16', 'C17',
  'D1', 'D2', 'D3', 'D5', 'D6', 'D7', 'D8', 'D9', 'D11', 'D12', 'D13', 'D14', 'D15', 'D16', 'D17', 'D18', 'D19', 'D20', 'D21',
  'E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7', 'E8', 'E9', 'E10', 'E11', 'E12', 'E13', 'E14', 'E15',
  'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12', 'F13', 'F14',
  'G1', 'G2', 'G3', 'G5', 'G6', 'G7', 'G8', 'G9', 'G13', 'G14', 'G17',
  'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'H7', 'H12', 'M5', 'M6', 'M9', 'M12', 'T1',
] as const;

/** 历史 96 色（MARD） */
export const PRESET_96_KEYS = [
  'A3', 'A4', 'A6', 'A7', 'A10', 'A11', 'A13', 'A14',
  'B3', 'B5', 'B7', 'B8', 'B10', 'B12', 'B14', 'B17', 'B18', 'B19', 'B20',
  'C2', 'C3', 'C5', 'C6', 'C7', 'C8', 'C10', 'C11', 'C13', 'C16',
  'D2', 'D3', 'D5', 'D6', 'D7', 'D8', 'D9', 'D11', 'D12', 'D13', 'D14', 'D15', 'D16', 'D18', 'D19', 'D20', 'D21',
  'E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7', 'E8', 'E9', 'E10', 'E11', 'E12', 'E13', 'E14', 'E15',
  'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12', 'F13', 'F14',
  'G1', 'G2', 'G3', 'G5', 'G7', 'G8', 'G9', 'G13', 'G14', 'G17',
  'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'H7', 'M5', 'M6', 'M9', 'M12', 'T1',
] as const;

/** 历史 72 色（MARD） */
export const PRESET_72_KEYS = [
  'A3', 'A4', 'A6', 'A7', 'A10', 'A11', 'A13',
  'B3', 'B5', 'B7', 'B8', 'B10', 'B12', 'B14', 'B17', 'B18', 'B19', 'B20',
  'C2', 'C3', 'C5', 'C6', 'C7', 'C8', 'C10', 'C11', 'C13', 'C16',
  'D2', 'D3', 'D6', 'D7', 'D8', 'D9', 'D11', 'D12', 'D13', 'D14', 'D15', 'D16', 'D18', 'D19', 'D20', 'D21',
  'E1', 'E2', 'E3', 'E4', 'E5', 'E8', 'E12', 'E13',
  'F5', 'F7', 'F8', 'F10', 'F13',
  'G1', 'G2', 'G3', 'G5', 'G7', 'G8', 'G9', 'G13',
  'H1', 'H2', 'H3', 'H4', 'H5', 'H7', 'T1',
] as const;

/** 221 全实色：排除珠光/特殊系列 ZG、Y、Q、P、R */
const SOLID_221_EXCLUDE_PREFIXES = new Set(['ZG', 'Y', 'Q', 'P', 'R']);

function mardPrefix(key: string): string {
  return key.match(/^[A-Z]+/)?.[0] ?? key;
}

/** 历史预设多为 A1；当前映射多为 A01 */
function normalizeMardKey(key: string): string {
  const match = key.match(/^([A-Za-z]+)(\d+)$/);
  if (!match) return key.toUpperCase();
  return `${match[1].toUpperCase()}${match[2].padStart(2, '0')}`;
}

function allMardKeys(): string[] {
  return Object.keys(getMardToHexMapping());
}

function solid221Keys(): string[] {
  return allMardKeys().filter((key) => !SOLID_221_EXCLUDE_PREFIXES.has(mardPrefix(key)));
}

function resolvePresetHexes(mardKeys: string[]): string[] {
  const mardToHex = getMardToHexMapping();
  const selectedHex: string[] = [];
  const seen = new Set<string>();
  for (const raw of mardKeys) {
    const key = normalizeMardKey(raw);
    const hex = mardToHex[key] ?? mardToHex[raw];
    if (!hex) continue;
    const normalized = hex.toUpperCase();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    selectedHex.push(normalized);
  }
  return selectedHex;
}

export type PalettePresetId = '291' | '221' | '168' | '144' | '120' | '96' | '72';

/** 首次进入 / 无本地配置时的默认预设 */
export const DEFAULT_PALETTE_PRESET_ID: PalettePresetId = '221';

export type PalettePreset = {
  id: PalettePresetId;
  /** 展示名 */
  label: string;
  /** 期望色数（展示用；实际以映射中能解析到的为准） */
  expectedCount: number;
  getMardKeys: () => string[];
};

export const PALETTE_PRESETS: PalettePreset[] = [
  {
    id: '291',
    label: '291 全色系',
    expectedCount: 291,
    getMardKeys: () => allMardKeys(),
  },
  {
    id: '221',
    label: '221 全实色',
    expectedCount: 221,
    getMardKeys: () => solid221Keys(),
  },
  {
    id: '168',
    label: '168 色',
    expectedCount: 168,
    getMardKeys: () => [...PRESET_168_KEYS],
  },
  {
    id: '144',
    label: '144 色',
    expectedCount: 144,
    getMardKeys: () => [...PRESET_144_KEYS],
  },
  {
    id: '120',
    label: '120 色',
    expectedCount: 120,
    getMardKeys: () => [...PRESET_120_KEYS],
  },
  {
    id: '96',
    label: '96 色',
    expectedCount: 96,
    getMardKeys: () => [...PRESET_96_KEYS],
  },
  {
    id: '72',
    label: '72 色',
    expectedCount: 72,
    getMardKeys: () => [...PRESET_72_KEYS],
  },
];

/** 将预设 MARD 色号转为基于 hex 的勾选状态 */
export function selectionsFromPreset(presetId: PalettePresetId): PaletteSelections {
  const preset = PALETTE_PRESETS.find((p) => p.id === presetId);
  const mardToHex = getMardToHexMapping();
  const allHex = Object.values(mardToHex).map((hex) => hex.toUpperCase());
  if (!preset) {
    return presetToSelections(allHex, allHex);
  }
  return presetToSelections(allHex, resolvePresetHexes(preset.getMardKeys()));
}

export function countPresetResolved(presetId: PalettePresetId): number {
  const preset = PALETTE_PRESETS.find((p) => p.id === presetId);
  if (!preset) return 0;
  return resolvePresetHexes(preset.getMardKeys()).length;
}
