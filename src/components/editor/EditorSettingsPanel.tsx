'use client';

import type { ChangeEvent } from 'react';
import { PixelationMode, type MappedPixel } from '../../utils/pixelation';
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
  onApplyGridWidth: (width: number) => void;
  onApplyGridHeight: (height: number) => void;
  onConfirmParameters: () => void;
  maxColorCount: number;
  onMaxColorCountChange: (value: number) => void;
  autoRemoveWhiteBg: boolean;
  onAutoRemoveWhiteBgChange: (value: boolean) => void;
  similarityThresholdInput: string;
  onSimilarityThresholdInputChange: (event: ChangeEvent<HTMLInputElement>) => void;
  pixelationMode: PixelationMode;
  onPixelationModeChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  customPaletteSelections: PaletteSelections;
  onOpenCustomPaletteEditor: () => void;
  onAutoRemoveBackground: () => void;
  onUndoBgRemoval: () => void;
  bgRemovalSnapshot: EditSnapshot | null;
};

/** 左侧「生成设置」区块：色板、尺寸、用色限制与进阶选项 */
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
  onConfirmParameters,
  maxColorCount,
  onMaxColorCountChange,
  autoRemoveWhiteBg,
  onAutoRemoveWhiteBgChange,
  similarityThresholdInput,
  onSimilarityThresholdInputChange,
  pixelationMode,
  onPixelationModeChange,
  customPaletteSelections,
  onOpenCustomPaletteEditor,
  onAutoRemoveBackground,
  onUndoBgRemoval,
  bgRemovalSnapshot,
}: EditorSettingsPanelProps) {
  return (
    <section className="bg-white dark:bg-gray-900 rounded-xl border border-[#eadfce] dark:border-gray-800 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[#3a2416] dark:text-gray-100">生成设置</h2>
        {mappedPixelData && <span className="text-[11px] font-medium text-[#c47a2c]">已生成</span>}
      </div>

      {/* 色板品牌 */}
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1.5">色板品牌</label>
        <select
          value={selectedColorSystem}
          onChange={(e) => onSelectedColorSystemChange(e.target.value as ColorSystem)}
          className="w-full h-10 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 text-sm text-gray-900 dark:text-gray-100"
        >
          {colorSystemOptions.map((option) => (
            <option key={option.key} value={option.key}>
              {option.name}
            </option>
          ))}
        </select>
      </div>

      {/* 图纸尺寸 宽 x 高 */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-300">图纸尺寸 (宽 × 高)</label>
          <button
            type="button"
            onClick={() => onKeepAspectRatioChange(!keepAspectRatio)}
            className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md border ${
              keepAspectRatio
                ? 'border-amber-400 bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-600'
                : 'border-gray-300 text-gray-500 dark:border-gray-600 dark:text-gray-400'
            }`}
            title="保持比例"
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
            onBlur={() => onApplyGridWidth(parseInt(granularityInput, 10) || 10)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onApplyGridWidth(parseInt(granularityInput, 10) || 10);
            }}
            className="w-full h-10 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 text-sm text-center"
          />
          <span className="text-gray-400">×</span>
          <input
            type="number"
            min={10}
            max={300}
            value={gridHeightInput}
            onChange={onGridHeightInputChange}
            onBlur={() => {
              if (!keepAspectRatio) onApplyGridHeight(parseInt(gridHeightInput, 10) || 10);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !keepAspectRatio) onApplyGridHeight(parseInt(gridHeightInput, 10) || 10);
            }}
            readOnly={keepAspectRatio}
            aria-label={keepAspectRatio ? '图纸高度（按比例自动计算）' : '图纸高度'}
            className={`w-full h-10 rounded-lg border border-gray-300 dark:border-gray-600 px-3 text-sm text-center ${keepAspectRatio ? 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 cursor-not-allowed' : 'bg-white dark:bg-gray-700'}`}
          />
        </div>
        <button
          type="button"
          onClick={onConfirmParameters}
          className="mt-2 w-full h-9 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium"
        >
          应用尺寸
          {gridDimensions ? ` · 当前 ${gridDimensions.N}×${gridDimensions.M}` : ''}
        </button>
      </div>

      {/* 精简拼豆种类 */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-300">🎨 精简拼豆种类 (限制用色)</label>
          <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
            {maxColorCount === 0 ? '无限制 (原图直转)' : `限制 ${maxColorCount} 色`}
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={30}
          step={1}
          value={maxColorCount}
          onChange={(e) => {
            onMaxColorCountChange(Number(e.target.value));
          }}
          className="w-full accent-amber-500"
        />
        <p className="mt-1.5 text-[11px] leading-relaxed text-gray-400 dark:text-gray-500">
          如果不限制，生成的图纸可能会用到几十种颜色，导致买豆成本极高。建议限制在 15-20 种以内。
        </p>
      </div>

      {/* 自动去除白底 */}
      <label className="flex items-start gap-2.5 cursor-pointer select-none rounded-lg border border-gray-200 dark:border-gray-700 p-3 hover:bg-gray-50 dark:hover:bg-gray-900/30">
        <input
          type="checkbox"
          checked={autoRemoveWhiteBg}
          onChange={(e) => onAutoRemoveWhiteBgChange(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-gray-300 text-amber-500 focus:ring-amber-400"
        />
        <span>
          <span className="block text-sm text-gray-800 dark:text-gray-100">✨ 自动去除白底 &amp; 紧凑排版</span>
          <span className="block mt-1 text-[11px] leading-relaxed text-gray-400 dark:text-gray-500">
            如果原图带有纯白背景，强烈建议勾选！会自动扣掉白底并减少废豆。
          </span>
        </span>
      </label>

      {/* 进阶选项 */}
      <details className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
        <summary className="cursor-pointer text-xs font-medium text-gray-600 dark:text-gray-300">进阶选项</summary>
        <div className="mt-3 space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">颜色合并阈值 (0-100)</label>
            <div className="flex gap-2">
              <input
                type="number"
                min={0}
                max={100}
                value={similarityThresholdInput}
                onChange={onSimilarityThresholdInputChange}
                className="w-full h-9 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 text-sm"
              />
              <button
                type="button"
                onClick={onConfirmParameters}
                className="h-9 px-3 rounded-md bg-gray-800 text-white text-xs whitespace-nowrap dark:bg-gray-600"
              >
                应用
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">处理模式</label>
            <select
              value={pixelationMode}
              onChange={onPixelationModeChange}
              className="w-full h-9 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 text-sm"
            >
              <option value={PixelationMode.Dominant}>卡通 (主色)</option>
              <option value={PixelationMode.Average}>真实 (平均)</option>
            </select>
          </div>
          <button
            type="button"
            onClick={onOpenCustomPaletteEditor}
            className="w-full h-9 rounded-md border border-gray-300 dark:border-gray-600 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            管理色板 ({Object.values(customPaletteSelections).filter(Boolean).length} 色)
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onAutoRemoveBackground}
              disabled={!mappedPixelData || !gridDimensions}
              className="flex-1 h-9 rounded-md border border-gray-300 dark:border-gray-600 text-xs disabled:opacity-50"
            >
              手动去背景
            </button>
            <button
              type="button"
              onClick={onUndoBgRemoval}
              disabled={!bgRemovalSnapshot}
              className="flex-1 h-9 rounded-md border border-gray-300 dark:border-gray-600 text-xs disabled:opacity-50"
            >
              回撤去背景
            </button>
          </div>
        </div>
      </details>
    </section>
  );
}
