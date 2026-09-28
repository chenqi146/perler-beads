import { PixelationMode } from '../../domain/pixelation';
import type { ColorSystem } from '../../utils/colorSystemUtils';
import type { UploadMode } from './editorUiStore';

export type ImagePrepInitialSettings = {
  gridWidth: number;
  gridHeight: number;
  keepAspectRatio: boolean;
  maxColorCount: number;
  selectedColorSystem: ColorSystem;
  ditheringEnabled: boolean;
  pixelationMode: PixelationMode;
};

export type ImagePrepConfirmMeta = {
  usedAiMatting: boolean;
  mode: UploadMode;
  gridWidth: number;
  gridHeight: number;
  keepAspectRatio: boolean;
  maxColorCount: number;
  selectedColorSystem: ColorSystem;
  /** 图纸识别：为 true 时自动检网格（忽略下方尺寸，仅作失败回退） */
  preferAutoGrid: boolean;
  /** 图片转像素：与外层设置同步 */
  ditheringEnabled: boolean;
  pixelationMode: PixelationMode;
};
