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

/** 高亮色亮度阈值：低于此值视为深色目标，提亮方式略有不同 */
const HIGHLIGHT_DARK_LUMA_THRESHOLD = 0.42;

export type HighlightRenderStyle = {
  /** 目标色是否偏深 */
  isDarkTarget: boolean;
  /** 盖在非目标格上的浅色蒙版（变淡） */
  dimOverlay: string;
  /** 盖在目标格上的提亮层 */
  accentLift: string;
  /** 目标格提亮用的合成模式 */
  accentLiftComposite: GlobalCompositeOperation;
  /** 高亮时非目标格的网格线 */
  mutedGridColor: string;
  /** 高亮时目标格网格（尽量不抢视觉） */
  accentGridColor: string;
};

/**
 * 高亮策略：非目标区域盖浅色蒙版变淡，目标色原样保留并轻微提亮。
 * @param fadeStrength 0–1，其他颜色淡化强度（页面滑块可调）
 */
export function getHighlightRenderStyle(
  highlightHex: string,
  isDarkMode = false,
  fadeStrength = 0.84,
): HighlightRenderStyle {
  const isDarkTarget = getRelativeLuminance(highlightHex) < HIGHLIGHT_DARK_LUMA_THRESHOLD;
  const t = Math.max(0, Math.min(1, fadeStrength));

  return {
    isDarkTarget,
    dimOverlay: isDarkMode
      ? `rgba(45, 52, 64, ${0.35 + t * 0.55})`
      : `rgba(245, 240, 232, ${0.35 + t * 0.55})`,
    accentLift: isDarkTarget ? 'rgba(255, 248, 240, 0.28)' : 'rgba(255, 255, 255, 0.12)',
    accentLiftComposite: isDarkTarget ? 'screen' : 'soft-light',
    mutedGridColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(90, 60, 40, 0.08)',
    accentGridColor: isDarkMode
      ? 'rgba(255, 255, 255, 0.16)'
      : isDarkTarget
        ? 'rgba(255, 255, 255, 0.2)'
        : 'rgba(0, 0, 0, 0.08)',
  };
}
