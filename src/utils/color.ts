function parseHexRgb(hex: string): { r: number; g: number; b: number } | null {
  const shorthand = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  const normalized = hex.replace(shorthand, (_match, r: string, g: string, b: string) => r + r + g + g + b + b);
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(normalized);
  if (!result) return null;
  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  };
}

/** Relative luminance in 0–1 (sRGB Rec. 709). */
export function getRelativeLuminance(hex: string): number {
  const rgb = parseHexRgb(hex);
  if (!rgb) return 0.5;
  return (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;
}

export function getContrastColor(hex: string): string {
  return getRelativeLuminance(hex) > 0.5 ? '#000000' : '#FFFFFF';
}

/** 高亮色亮度阈值：低于此值视为深色，用浅底压暗非目标格 */
const HIGHLIGHT_DARK_LUMA_THRESHOLD = 0.42;

export type HighlightRenderStyle = {
  /** 目标色是否偏深 */
  isDarkTarget: boolean;
  /** 盖在非目标格上的蒙版（暖色调，避免冷灰） */
  dimOverlay: string;
  /** 盖在目标格上的提亮层 */
  accentLift: string;
  /** 目标格提亮用的合成模式 */
  accentLiftComposite: GlobalCompositeOperation;
  /** 色块外轮廓描边 */
  silhouetteStroke: string;
  /** 高亮时非目标格的网格线 */
  mutedGridColor: string;
  /** 高亮时目标格内部网格（更淡，不抢轮廓） */
  accentGridColor: string;
};

/**
 * 按高亮色亮度选择压暗策略：
 * - 深色目标 → 暖浅蒙版（避免深色埋进灰底）+ screen 提亮
 * - 浅色目标 → 暖深蒙版 + 轻微提亮
 * 描边只用于色块外轮廓，不在每格画框。
 */
export function getHighlightRenderStyle(highlightHex: string, isDarkMode = false): HighlightRenderStyle {
  const isDarkTarget = getRelativeLuminance(highlightHex) < HIGHLIGHT_DARK_LUMA_THRESHOLD;

  if (isDarkTarget) {
    return {
      isDarkTarget: true,
      // 略加强蒙版，拉开与选中区的对比
      dimOverlay: isDarkMode ? 'rgba(250, 246, 240, 0.78)' : 'rgba(250, 246, 240, 0.76)',
      // screen 提亮：提亮度同时保色相
      accentLift: 'rgba(255, 248, 240, 0.28)',
      accentLiftComposite: 'screen',
      silhouetteStroke: isDarkMode ? 'rgba(255, 252, 248, 0.95)' : 'rgba(255, 255, 255, 0.98)',
      mutedGridColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(90, 60, 40, 0.05)',
      accentGridColor: isDarkMode ? 'rgba(255, 255, 255, 0.18)' : 'rgba(255, 255, 255, 0.28)',
    };
  }

  return {
    isDarkTarget: false,
    dimOverlay: isDarkMode ? 'rgba(28, 20, 14, 0.64)' : 'rgba(42, 28, 18, 0.56)',
    accentLift: 'rgba(255, 255, 255, 0.14)',
    accentLiftComposite: 'soft-light',
    silhouetteStroke: isDarkMode ? 'rgba(42, 28, 18, 0.9)' : 'rgba(42, 28, 18, 0.82)',
    mutedGridColor: isDarkMode ? 'rgba(255, 255, 255, 0.06)' : 'rgba(255, 255, 255, 0.1)',
    accentGridColor: isDarkMode ? 'rgba(0, 0, 0, 0.2)' : 'rgba(0, 0, 0, 0.12)',
  };
}
