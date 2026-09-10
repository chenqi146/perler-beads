import React, { useEffect, useState } from 'react';
import { GridDownloadOptions } from '../types/downloadTypes';
import { ColorSwatch } from './ui/ColorSwatch';
import { CloseIcon, IconButton } from './ui/IconButton';
import { Overlay } from './ui/Overlay';
import { Switch } from './ui/Switch';

// 定义可选的网格线颜色
const gridLineColorOptions = [
  { name: '深灰色', value: '#555555' },
  { name: '红色', value: '#FF0000' },
  { name: '蓝色', value: '#0000FF' },
  { name: '绿色', value: '#008000' },
  { name: '紫色', value: '#800080' },
  { name: '橙色', value: '#FFA500' },
];

interface DownloadSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  options: GridDownloadOptions;
  onOptionsChange: (options: GridDownloadOptions) => void;
  onDownload: (opts?: GridDownloadOptions) => void;
  previewUrl?: string | null;
  previewLoading?: boolean;
  onPreview?: (options: GridDownloadOptions) => void;
}

const DownloadSettingsModal: React.FC<DownloadSettingsModalProps> = ({
  isOpen,
  onClose,
  options,
  onOptionsChange,
  onDownload,
  previewUrl,
  previewLoading = false,
  onPreview
}) => {
  // 将useState移到顶层，不管isOpen是什么值
  const [tempOptions, setTempOptions] = useState<GridDownloadOptions>({...options});

  useEffect(() => {
    if (!isOpen) return;
    setTempOptions({ ...options });
    onPreview?.(options);
    // 只在打开时用当前参数生成一次预览
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);
  
  // 如果不是打开状态，仍然可以返回null
  if (!isOpen) return null;
  
  // 处理选项变更 - 使用更具体的类型而不是any
  const handleOptionChange = (key: keyof GridDownloadOptions, value: string | number | boolean) => {
    setTempOptions((prev: GridDownloadOptions) => {
      const next = { ...prev, [key]: value };
      onOptionsChange(next);
      onPreview?.(next);
      return next;
    });
  };
  
  const handleSave = () => {
    onOptionsChange(tempOptions);
    onDownload(tempOptions);
  };
  
  return (
    <Overlay
      labelledBy="download-settings-title"
      layer="import"
      closeOnBackdrop={false}
      onClose={onClose}
      panelClassName="h-[92vh] max-w-6xl"
    >
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
          <div>
            <h3 id="download-settings-title" className="text-base font-semibold text-gray-900 dark:text-gray-100">导出图纸</h3>
            <p className="mt-0.5 text-[11px] text-gray-500">调整参数后预览完整图纸，再下载</p>
          </div>
          <IconButton aria-label="关闭" onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </div>

        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <div className="w-full shrink-0 overflow-y-auto border-b border-gray-200 p-4 dark:border-gray-700 lg:w-[320px] lg:border-b-0 lg:border-r">
          <div className="space-y-4">
            <Switch
              label="显示网格线"
              checked={tempOptions.showGrid}
              onChange={(checked) => handleOptionChange('showGrid', checked)}
            />
            
            {/* 网格线设置 (仅当显示网格线时) */}
            {tempOptions.showGrid && (
              <div className="space-y-4 pl-2 border-l-2 border-gray-200 dark:border-gray-700 ml-1 pt-2 pb-1">
                {/* 网格线间隔选项 */}
                <div className="flex flex-col space-y-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    网格线间隔 (每 N 格画一条线)
                  </label>
                  <div className="flex items-center justify-between space-x-3">
                    <input 
                      type="range" 
                      min="5" 
                      max="20" 
                      step="1"
                      value={tempOptions.gridInterval}
                      onChange={(e) => handleOptionChange('gridInterval', parseInt(e.target.value))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                    />
                    <span className="flex items-center justify-center min-w-[40px] text-sm font-medium text-gray-900 dark:text-gray-100">
                      {tempOptions.gridInterval}
                    </span>
                  </div>
                </div>

                {/* 网格线颜色选择 */}
                <div className="flex flex-col space-y-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    网格线颜色
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {gridLineColorOptions.map(colorOpt => (
                      <ColorSwatch
                        key={colorOpt.value}
                        hex={colorOpt.value}
                        size="md"
                        shape="circle"
                        isSelected={tempOptions.gridLineColor === colorOpt.value}
                        aria-label={colorOpt.name}
                        onClick={() => handleOptionChange('gridLineColor', colorOpt.value)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
            
            <Switch
              label="显示坐标数字"
              checked={tempOptions.showCoordinates}
              onChange={(checked) => handleOptionChange('showCoordinates', checked)}
            />
            <Switch
              label="隐藏格内色号"
              checked={!tempOptions.showCellNumbers}
              onChange={(checked) => handleOptionChange('showCellNumbers', !checked)}
            />
            <Switch
              label="包含色号统计"
              checked={tempOptions.includeStats}
              onChange={(checked) => handleOptionChange('includeStats', checked)}
            />
            <Switch
              label="同时导出源数据"
              description="导出hex颜色值的CSV文件，可用于重新导入"
              checked={tempOptions.exportCsv}
              onChange={(checked) => handleOptionChange('exportCsv', checked)}
            />
          </div>
          </div>

          <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-[#eef0f3] dark:bg-gray-950">
            <div className="relative min-h-0 flex-1">
              {previewLoading ? (
                <div className="flex h-full items-center justify-center text-sm text-gray-500">正在生成完整预览…</div>
              ) : previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewUrl}
                  alt="导出图纸预览"
                  className="absolute inset-0 m-auto max-h-full max-w-full object-contain p-3"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-gray-500">预览生成失败</div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-gray-200 px-4 py-3 dark:border-gray-700">
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-lg bg-gray-200 px-4 text-sm text-gray-800 hover:bg-gray-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!previewUrl || previewLoading}
            className="h-9 rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50"
          >
            下载图纸
          </button>
        </div>
    </Overlay>
  );
};

export default DownloadSettingsModal;
export { gridLineColorOptions }; 
