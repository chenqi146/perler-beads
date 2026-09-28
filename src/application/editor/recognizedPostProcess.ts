import {
  absorbSimilarSpeckles,
  limitColorCount,
  removeEdgeBackground,
  recountColors,
  scalePixelGrid,
  type MappedPixel,
  type PaletteColor,
} from '../../domain/pixelation';
import { useEditorStore } from './editorStore';

function cloneGrid(data: MappedPixel[][]): MappedPixel[][] {
  return data.map((row) => row.map((cell) => ({ ...cell })));
}

export type RecognizedPostProcessOpts = {
  similarityThreshold?: number;
  maxColorCount?: number;
  autoRemoveWhiteBg?: boolean;
};

/**
 * 在识别底稿上应用后处理（不从原图转像素）。
 * 合并阈值=0、不限色、不去底 → 还原识别快照。
 */
export function reapplyRecognizedPostProcess(opts?: RecognizedPostProcessOpts): boolean {
  const state = useEditorStore.getState();
  const baseline = state.recognizedBaseline;
  if (!baseline || state.patternSource !== 'recognize') return false;

  const threshold =
    typeof opts?.similarityThreshold === 'number'
      ? opts.similarityThreshold
      : state.similarityThreshold;
  const colorLimit =
    typeof opts?.maxColorCount === 'number' ? opts.maxColorCount : state.maxColorCount;
  const removeBg =
    typeof opts?.autoRemoveWhiteBg === 'boolean'
      ? opts.autoRemoveWhiteBg
      : state.autoRemoveWhiteBg;
  const palette: PaletteColor[] = state.activeBeadPalette;

  let next = cloneGrid(baseline);
  if (threshold > 0) {
    next = absorbSimilarSpeckles(next, threshold);
  }
  if (colorLimit > 0 && palette.length > 0) {
    next = limitColorCount(next, palette, colorLimit);
  }
  if (removeBg) {
    next = removeEdgeBackground(next, true);
  }

  const { counts, total } = recountColors(next);
  state.setMappedPixelData(next);
  state.setColorCounts(counts);
  state.setTotalBeadCount(total);
  return true;
}

/**
 * 识别结果改尺寸：缩放底稿后再跑后处理，避免走原图转像素。
 */
export function rescaleRecognizedPattern(nextN: number, nextM: number): boolean {
  const state = useEditorStore.getState();
  const baseline = state.recognizedBaseline;
  if (!baseline || state.patternSource !== 'recognize') return false;

  const scaled = scalePixelGrid(baseline, nextN, nextM);
  state.setRecognizedBaseline(scaled);
  state.setGridDimensions({ N: nextN, M: nextM });
  state.setGranularity(nextN);
  state.setGridHeight(nextM);
  state.setGranularityInput(String(nextN));
  state.setGridHeightInput(String(nextM));
  return reapplyRecognizedPostProcess();
}

/**
 * 统一：有识别底稿则后处理/缩放；否则从原图重算。
 * 抖动/模式/对比度等生成向参数在识别态下只改设置值，画布保持识别结果。
 */
export function refreshPatternAfterSettingsChange(
  remap: (opts?: { silent?: boolean }) => void,
  opts?: RecognizedPostProcessOpts & { silent?: boolean },
): void {
  if (reapplyRecognizedPostProcess(opts)) return;
  remap({ silent: opts?.silent });
}
