import { PixelationMode } from './pixelation';

/** 创作预设：把池化方式、并色、抖动打成少选项 */
export type CreativePresetId = 'clear' | 'cartoon' | 'photo';

export type CreativePresetConfig = {
  id: CreativePresetId;
  label: string;
  hint: string;
  pixelationMode: PixelationMode;
  /** 颜色合并阈值（CIEDE2000） */
  similarityThreshold: number;
  /** 是否默认开启抖动（写实可再手动关） */
  dithering: boolean;
};

export const CREATIVE_PRESETS: Record<CreativePresetId, CreativePresetConfig> = {
  clear: {
    id: 'clear',
    label: '清晰',
    hint: '保线稿，适合插画与文字',
    pixelationMode: PixelationMode.EdgeAware,
    similarityThreshold: 0,
    dithering: false,
  },
  cartoon: {
    id: 'cartoon',
    label: '卡通',
    hint: '主色块，适合色块清晰的图',
    pixelationMode: PixelationMode.Dominant,
    similarityThreshold: 0,
    dithering: false,
  },
  photo: {
    id: 'photo',
    label: '写实',
    hint: '照片渐变，可开抖动',
    pixelationMode: PixelationMode.Average,
    similarityThreshold: 0,
    dithering: false,
  },
};

export const CREATIVE_PRESET_ORDER: CreativePresetId[] = ['cartoon', 'clear', 'photo'];

/** 根据当前模式反推预设；抖动为独立开关，不影响预设高亮 */
export function matchCreativePreset(mode: PixelationMode): CreativePresetId | null {
  if (mode === PixelationMode.EdgeAware) return 'clear';
  if (mode === PixelationMode.Dominant) return 'cartoon';
  if (mode === PixelationMode.Average) return 'photo';
  return null;
}
