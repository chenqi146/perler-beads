'use client';

import type { ChangeEvent } from 'react';
import { PixelationMode, type MappedPixel } from '../../utils/pixelation';
import {
  CREATIVE_PRESET_ORDER,
  CREATIVE_PRESETS,
  type CreativePresetId,
} from '../../domain/pixelation';
import {
  colorSystemOptions,
  type ColorSystem,
} from '../../utils/colorSystemUtils';
import type { PaletteSelections } from '../../utils/localStorageUtils';
import type { EditSnapshot } from '../../stores';
import { Switch } from '../ui/Switch';

function clampInt(raw: string, min: number, max: number, fallback: number): number {
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function asInputChange(value: string): ChangeEvent<HTMLInputElement> {
  return { target: { value } } as ChangeEvent<HTMLInputElement>;
}

export type EditorSettingsPanelProps = {
  mappedPixelData: MappedPixel[][] | null;
  gridDimensions: { N: number; M: number } | null;
  selectedColorSystem: ColorSystem;
  onSelectedColorSystemChange: (system: ColorSystem) => void;
  keepAspectRatio: boolean;
  onKeepAspectRatioChange: (value: boolean) => void;
  granularityInput: string;
  gridHeightInput: string;
  onGranularityInputChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onGridHeightInputChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onApplyGridWidth: () => void;
  onApplyGridHeight: () => void;
  maxColorCount: number;
  onMaxColorCountChange: (value: number) => void;
  autoRemoveWhiteBg: boolean;
  onAutoRemoveWhiteBgChange: (value: boolean) => void;
  similarityThresholdInput: string;
  onSimilarityThresholdInputChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onApplySimilarity: () => void;
  creativePreset: CreativePresetId | null;
  onCreativePresetChange: (id: CreativePresetId) => void;
  ditheringEnabled: boolean;
  onDitheringChange: (value: boolean) => void;
  imageContrast: number;
  onImageContrastChange: (value: number) => void;
  imageSaturation: number;
  onImageSaturationChange: (value: number) => void;
  pixelationMode: PixelationMode;
  onPixelationModeChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  customPaletteSelections: PaletteSelections;
  onManagePalette: () => void;
  onAutoRemoveBackground: () => void;
  onUndoBgRemoval: () => void;
  bgRemovalSnapshot: EditSnapshot | null;
  gridManuallyEdited: boolean;
  sizePending: boolean;
  onScaleGrid: () => void;
  onRegenerateFromOriginal: () => void;
};

/** 左侧「生成设置」：改参数会从原图实时重算；若有手改会被覆盖 */
export function EditorSettingsPanel({
  mappedPixelData,
  gridDimensions,
  selectedColorSystem,
  onSelectedColorSystemChange,
  keepAspectRatio,
  onKeepAspectRatioChange,
  granularityInput,
  gridHeightInput,
  onGranularityInputChange,
  onGridHeightInputChange,
  onApplyGridWidth,
  onApplyGridHeight,
  maxColorCount,
  onMaxColorCountChange,
  autoRemoveWhiteBg,
  onAutoRemoveWhiteBgChange,
  similarityThresholdInput,
  onSimilarityThresholdInputChange,
  onApplySimilarity,
  creativePreset,
  onCreativePresetChange,
  ditheringEnabled,
  onDitheringChange,
  imageContrast,
  onImageContrastChange,
  imageSaturation,
  onImageSaturationChange,
  pixelationMode,
  onPixelationModeChange,
  customPaletteSelections,
  onManagePalette,
  onAutoRemoveBackground,
  onUndoBgRemoval,
  bgRemovalSnapshot,
  gridManuallyEdited,
  sizePending,
  onScaleGrid,
  onRegenerateFromOriginal,
}: EditorSettingsPanelProps) {
  const selectedCount = Object.values(customPaletteSelections).filter(Boolean).length;
  const activePresetHint =
    creativePreset != null ? CREATIVE_PRESETS[creativePreset].hint : '已手动调整处理参数';
  const gridWidth = clampInt(granularityInput, 10, 300, 50);
  const gridHeight = clampInt(gridHeightInput, 10, 300, 50);
  const similarity = clampInt(similarityThresholdInput, 0, 100, 0);

  return (
    <section className="bg-white dark:bg-gray-900 rounded-xl border border-[#eadfce] dark:border-gray-800 p-4 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-[#3a2416] dark:text-gray-100">生成设置</h2>
        <div className="flex shrink-0 items-center gap-1.5">
          {mappedPixelData && (
            gridManuallyEdited ? (
              <>
                <span className="text-[11px] font-medium text-[#c47a2c]" title="已手改格子；改左侧参数会从原图重算并覆盖手改">
                  已手改
                </span>
                <button
                  type="button"
                  onClick={onScaleGrid}
                  disabled={!sizePending}
                  title="缩放到输入尺寸（保留手改）"
                  className="app-btn app-btn--chip app-btn--sm"
                >
                  缩放
                </button>
                <button
                  type="button"
                  onClick={onRegenerateFromOriginal}
                  title="从原图重新生成（会丢弃手改）"
                  className="app-btn app-btn--chip app-btn--sm"
                >
                  重生成
                </button>
              </>
            ) : (
              <span className="text-[11px] font-medium text-[#c47a2c]">已生成</span>
            )
          )}
          <button
            type="button"
            onClick={onManagePalette}
            className="app-btn app-btn--chip app-btn--sm"
            title="管理色板"
          >
            色板 {selectedCount}
          </button>
        </div>
      </div>

      {/* 图纸尺寸 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <label className="text-xs font-medium text-gray-600 dark:text-gray-300">图纸尺寸</label>
          <span className="text-[11px] font-medium tabular-nums text-amber-600 dark:text-amber-400">
            {gridWidth}×{gridHeight}
          </span>
        </div>

        <Switch
          checked={keepAspectRatio}
          onChange={onKeepAspectRatioChange}
          label="保持比例"
        />

        <div>
          <div className="mb-1 flex items-center justify-between gap-2">
            <label className="text-xs text-gray-500 dark:text-gray-400">宽度</label>
            <span className="text-[11px] tabular-nums text-[#a08060]">{gridWidth}</span>
          </div>
          <input
            type="range"
            min={10}
            max={300}
            step={1}
            value={gridWidth}
            onChange={(e) => onGranularityInputChange(asInputChange(e.target.value))}
            onMouseUp={onApplyGridWidth}
            onTouchEnd={onApplyGridWidth}
            className="w-full accent-amber-500"
            aria-label="图纸宽度"
          />
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between gap-2">
            <label className="text-xs text-gray-500 dark:text-gray-400">高度</label>
            <span className="text-[11px] tabular-nums text-[#a08060]">{gridHeight}</span>
          </div>
          <input
            type="range"
            min={10}
            max={300}
            step={1}
            value={gridHeight}
            disabled={keepAspectRatio}
            onChange={(e) => onGridHeightInputChange(asInputChange(e.target.value))}
            onMouseUp={onApplyGridHeight}
            onTouchEnd={onApplyGridHeight}
            className="w-full accent-amber-500 disabled:opacity-50"
            aria-label={keepAspectRatio ? '图纸高度（按比例自动计算）' : '图纸高度'}
          />
        </div>

        <p className="text-[11px] tabular-nums text-[#a08060]">
          {gridDimensions ? `当前图纸 ${gridDimensions.N}×${gridDimensions.M}` : '尚未生成'}
          {gridManuallyEdited
            ? ' · 有手改时改尺寸会从原图重算；只想改大小可点「缩放」'
            : ' · 改动后自动生成'}
        </p>
      </div>

      {/* 色板品牌 */}
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1.5">色板品牌</label>
        <select
          value={selectedColorSystem}
          onChange={(e) => onSelectedColorSystemChange(e.target.value as ColorSystem)}
          className="w-full h-10 rounded-lg border border-[#e0d0bc] dark:border-gray-600 bg-white dark:bg-gray-700 px-3 text-sm text-gray-900 dark:text-gray-100"
        >
          {colorSystemOptions.map((option) => (
            <option key={option.key} value={option.key}>
              {option.name}
            </option>
          ))}
        </select>
      </div>

      {/* 精简拼豆种类 */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-300">精简拼豆种类</label>
          <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
            {maxColorCount === 0 ? '无限制' : `${maxColorCount} 色`}
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={50}
          step={1}
          value={maxColorCount}
          onChange={(e) => {
            onMaxColorCountChange(Number(e.target.value));
          }}
          className="w-full accent-amber-500"
          aria-label="限制拼豆颜色数量"
        />
        <p className="mt-1.5 text-[11px] leading-relaxed text-gray-400 dark:text-gray-500">
          {gridManuallyEdited
            ? '已手改时改此项会从原图重算并覆盖手改。'
            : '不限制可能用到几十种色；建议 15–30。'}
        </p>
      </div>

      {/* 创作预设 */}
      <div>
        <label className="mb-1.5 block text-xs font-medium text-gray-600 dark:text-gray-300">
          创作风格
        </label>
        <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="创作风格预设">
          {CREATIVE_PRESET_ORDER.map((id) => {
            const preset = CREATIVE_PRESETS[id];
            const selected = creativePreset === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onCreativePresetChange(id)}
                aria-pressed={selected}
                className={`rounded-xl border px-2 py-2 text-center transition-colors ${
                  selected
                    ? 'border-[#c47a2c] bg-[#fff4e6] text-[#8a4e18]'
                    : 'border-[#e0d0bc] bg-white text-[#5a4030] hover:border-[#d4b896] dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200'
                }`}
              >
                <span className="block text-sm font-medium">{preset.label}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-1.5 text-[11px] leading-relaxed text-gray-400 dark:text-gray-500">
          {activePresetHint}
        </p>
      </div>

      <details className="rounded-xl border border-[#eadfce] bg-[#fffaf3] px-3 py-2">
        <summary className="cursor-pointer list-none text-xs font-semibold text-[#5c4030]">
          更多处理选项
          <span className="ml-2 font-normal text-[#a08060]">对比度、背景、颜色合并</span>
        </summary>
        <div className="mt-4 space-y-4">
          {/* 生成前外观 */}
          <div className="space-y-3">
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-300">
                  对比度
                </label>
                <span className="text-xs font-medium tabular-nums text-amber-600 dark:text-amber-400">
                  {imageContrast > 0 ? `+${imageContrast}` : imageContrast}
                </span>
              </div>
              <input
                type="range"
                min={-50}
                max={50}
                step={1}
                value={imageContrast}
                onChange={(e) => onImageContrastChange(Number(e.target.value))}
                className="w-full accent-amber-500"
                aria-label="生成前对比度"
              />
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-300">
                  饱和度
                </label>
                <span className="text-xs font-medium tabular-nums text-amber-600 dark:text-amber-400">
                  {imageSaturation > 0 ? `+${imageSaturation}` : imageSaturation}
                </span>
              </div>
              <input
                type="range"
                min={-50}
                max={50}
                step={1}
                value={imageSaturation}
                onChange={(e) => onImageSaturationChange(Number(e.target.value))}
                className="w-full accent-amber-500"
                aria-label="生成前饱和度"
              />
            </div>
            <p className="text-[11px] leading-relaxed text-gray-400 dark:text-gray-500">
              {gridManuallyEdited
                ? '已手改时改此项会从原图重算并覆盖手改。'
                : '像素化前调整原图。浅色贴画可试对比度 +15～+25、饱和度 +10～+20。'}
            </p>
          </div>

          <Switch
            checked={autoRemoveWhiteBg}
            onChange={onAutoRemoveWhiteBgChange}
            label="自动去除白底"
          />

          <Switch
            checked={ditheringEnabled}
            onChange={onDitheringChange}
            label="颜色抖动（Floyd–Steinberg）"
            description={
              gridManuallyEdited
                ? '已手改时改此项会从原图重算并覆盖手改。'
                : '用邻格混色保留渐变层次，适合照片；开启后会跳过清杂点以免抹掉抖动。卡通/线稿建议关闭。'
            }
          />

          {/* 处理模式 + 去背景 */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <label className="shrink-0 text-xs text-gray-500 w-14">处理模式</label>
              <select
                value={pixelationMode}
                onChange={onPixelationModeChange}
                className="min-w-0 flex-1 h-9 rounded-lg border border-[#e0d0bc] dark:border-gray-600 bg-white dark:bg-gray-700 px-2 text-xs"
              >
                <option value={PixelationMode.EdgeAware}>清晰 (保线稿)</option>
                <option value={PixelationMode.Dominant}>卡通 (主色)</option>
                <option value={PixelationMode.Average}>真实 (平均)</option>
              </select>
            </div>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={onAutoRemoveBackground}
                disabled={!mappedPixelData || !gridDimensions}
                className="app-btn app-btn--secondary app-btn--xs flex-1"
              >
                手动去背景
              </button>
              <button
                type="button"
                onClick={onUndoBgRemoval}
                disabled={!bgRemovalSnapshot}
                className="app-btn app-btn--secondary app-btn--xs flex-1"
              >
                回撤去背景
              </button>
            </div>
          </div>

          {/* 颜色合并 */}
          <div>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
                颜色合并阈值
              </label>
              <span className="text-[11px] font-medium tabular-nums text-amber-600 dark:text-amber-400">
                {similarity}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={similarity}
              onChange={(e) => onSimilarityThresholdInputChange(asInputChange(e.target.value))}
              onMouseUp={onApplySimilarity}
              onTouchEnd={onApplySimilarity}
              aria-label="颜色合并阈值"
              className="w-full accent-amber-500"
            />
            <p className="mt-1.5 text-[11px] leading-relaxed text-gray-400 dark:text-gray-500">
              {gridManuallyEdited
                ? '已手改时改此项会从原图重算并覆盖手改。'
                : '越大越容易清掉被包围的小块杂色；成片大色块会保留，不会整色吃掉。'}
            </p>
          </div>
        </div>
      </details>
    </section>
  );
}
