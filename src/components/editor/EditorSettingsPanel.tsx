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

/** 左侧「生成设置」：未手改时改动即生成；已手改时需缩放或重新生成 */
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

  return (
    <section className="bg-white dark:bg-gray-900 rounded-xl border border-[#eadfce] dark:border-gray-800 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[#3a2416] dark:text-gray-100">生成设置</h2>
        {mappedPixelData && (
          <span className="text-[11px] font-medium text-[#c47a2c]">
            {gridManuallyEdited ? '已手改' : '已生成'}
          </span>
        )}
      </div>

      {gridManuallyEdited ? (
        <div className="space-y-2 rounded-xl border border-[#e8c49a] bg-[#fff4e6] px-3 py-2.5">
          <p className="text-[11px] leading-relaxed text-[#8a4e18]">
            图纸已手动修改。改左侧参数不会自动重算；可缩放当前图纸，或从原图重新生成。
          </p>
          <div className="flex flex-col gap-1.5">
            <button
              type="button"
              onClick={onScaleGrid}
              disabled={!sizePending}
              className="app-btn app-btn--soft app-btn--block app-btn--sm"
            >
              缩放到输入尺寸（保留手改）
            </button>
            <button
              type="button"
              onClick={onRegenerateFromOriginal}
              className="app-btn app-btn--secondary app-btn--block app-btn--sm"
            >
              从原图重新生成…
            </button>
          </div>
        </div>
      ) : null}

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

      <button
        type="button"
        onClick={onManagePalette}
        className="app-btn app-btn--soft app-btn--block app-btn--md"
      >
        管理色板（{selectedCount} 色）
      </button>

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

      {/* 图纸尺寸 宽 x 高 */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-300">图纸尺寸 (宽 × 高)</label>
          <button
            type="button"
            onClick={() => onKeepAspectRatioChange(!keepAspectRatio)}
            className={`app-btn app-btn--chip ${keepAspectRatio ? 'is-on' : ''}`}
            title="保持比例"
            aria-pressed={keepAspectRatio}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
              <path
                fillRule="evenodd"
                d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                clipRule="evenodd"
              />
            </svg>
            保持比例
          </button>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={10}
            max={300}
            value={granularityInput}
            onChange={onGranularityInputChange}
            onBlur={onApplyGridWidth}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.currentTarget.blur();
              }
            }}
            className="w-full h-10 rounded-lg border border-[#e0d0bc] dark:border-gray-600 bg-white dark:bg-gray-700 px-3 text-sm text-center"
          />
          <span className="text-gray-400">×</span>
          <input
            type="number"
            min={10}
            max={300}
            value={gridHeightInput}
            onChange={onGridHeightInputChange}
            onBlur={onApplyGridHeight}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !keepAspectRatio) {
                e.currentTarget.blur();
              }
            }}
            readOnly={keepAspectRatio}
            aria-label={keepAspectRatio ? '图纸高度（按比例自动计算）' : '图纸高度'}
            className={`w-full h-10 rounded-lg border border-[#e0d0bc] dark:border-gray-600 px-3 text-sm text-center ${keepAspectRatio ? 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 cursor-not-allowed' : 'bg-white dark:bg-gray-700'}`}
          />
        </div>
        <p className="mt-1.5 text-[11px] tabular-nums text-[#a08060]">
          {gridDimensions ? `当前图纸 ${gridDimensions.N}×${gridDimensions.M}` : '尚未生成'}
          {gridManuallyEdited
            ? sizePending
              ? ' · 输入尺寸待应用'
              : ' · 改尺寸请用上方按钮'
            : ' · 改动后自动生成'}
        </p>
      </div>

      {/* 精简拼豆种类 */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-300">精简拼豆种类 (限制用色)</label>
          <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
            {maxColorCount === 0 ? '无限制 (原图直转)' : `限制 ${maxColorCount} 色`}
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
        />
        <p className="mt-1.5 text-[11px] leading-relaxed text-gray-400 dark:text-gray-500">
          {gridManuallyEdited
            ? '已手改时此项仅在「从原图重新生成」时生效。'
            : '如果不限制，生成的图纸可能会用到几十种颜色。建议限制在 15-30 种以内。'}
        </p>
      </div>

      {/* 自动去除白底 */}
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={autoRemoveWhiteBg}
          onChange={(e) => onAutoRemoveWhiteBgChange(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-amber-500 focus:ring-amber-400"
        />
        <span className="text-sm text-gray-800 dark:text-gray-100">自动去除白底</span>
      </label>

      {/* Floyd–Steinberg 抖动 */}
      <div className="space-y-1">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={ditheringEnabled}
            onChange={(e) => onDitheringChange(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-amber-500 focus:ring-amber-400"
          />
          <span className="text-sm text-gray-800 dark:text-gray-100">颜色抖动（Floyd–Steinberg）</span>
        </label>
        <p className="pl-6 text-[11px] leading-relaxed text-gray-400 dark:text-gray-500">
          {gridManuallyEdited
            ? '已手改时此项仅在「从原图重新生成」时生效。'
            : '用邻格混色保留渐变层次，适合照片；开启后会跳过清杂点以免抹掉抖动。卡通/线稿建议关闭。'}
        </p>
      </div>

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
        <label className="mb-1.5 block text-xs font-medium text-gray-600 dark:text-gray-300">
          颜色合并阈值
        </label>
        <input
          type="number"
          min={0}
          max={100}
          value={similarityThresholdInput}
          onChange={onSimilarityThresholdInputChange}
          onBlur={onApplySimilarity}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
          }}
          aria-label="颜色合并阈值"
          className="w-full h-9 rounded-xl border border-[#e0d0bc] bg-white px-3 text-sm dark:border-gray-600 dark:bg-gray-700"
        />
        <p className="mt-1.5 text-[11px] leading-relaxed text-gray-400 dark:text-gray-500">
          {gridManuallyEdited
            ? '已手改时此项仅在「从原图重新生成」时生效。'
            : '数值越大，相近色越容易合并。改动后自动生效。'}
        </p>
      </div>
    </section>
  );
}
