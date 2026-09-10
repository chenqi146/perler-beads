import React, { useState } from 'react';
import { ColorSwatch } from './ui/ColorSwatch';
import { Overlay } from './ui/Overlay';

interface ColorInfo {
  color: string;
  name: string;
  total: number;
  completed: number;
}

interface ColorPanelProps {
  colors: ColorInfo[];
  currentColor: string;
  onColorSelect: (color: string) => void;
  onClose: () => void;
}

const ColorPanel: React.FC<ColorPanelProps> = ({
  colors,
  currentColor,
  onColorSelect,
  onClose
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'progress' | 'name' | 'total'>('progress');

  // 过滤和排序颜色
  const filteredAndSortedColors = colors
    .filter(color => 
      color.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      color.color.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      switch (sortBy) {
        case 'progress':
          const progressA = (a.completed / a.total) * 100;
          const progressB = (b.completed / b.total) * 100;
          return progressA - progressB; // 进度低的在前
        case 'name':
          return a.name.localeCompare(b.name);
        case 'total':
          return b.total - a.total; // 数量多的在前
        default:
          return 0;
      }
    });

  return (
    <Overlay labelledBy="color-panel-title" placement="sheet" onClose={onClose}>
        <h2 id="color-panel-title" className="sr-only">选择颜色</h2>
        <div className="flex justify-center py-2">
          <div className="w-10 h-1 bg-gray-300 rounded-full"></div>
        </div>

        <div className="px-4 pb-3">
          <div className="relative">
            <label htmlFor="color-panel-search" className="sr-only">搜索颜色</label>
            <input
              id="color-panel-search"
              type="search"
              name="color-search"
              autoComplete="off"
              spellCheck={false}
              placeholder="搜索颜色…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            />
            <svg
              className="absolute left-3 top-2.5 h-5 w-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        {/* 排序选项 */}
        <div className="px-4 pb-3">
          <label htmlFor="color-panel-sort" className="sr-only">排序方式</label>
          <select
            id="color-panel-sort"
            name="color-sort"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'progress' | 'name' | 'total')}
            className="w-full rounded-lg border border-gray-300 bg-white p-2 text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <option value="progress">按进度排序</option>
            <option value="name">按名称排序</option>
            <option value="total">按数量排序</option>
          </select>
        </div>

        {/* 颜色列表 */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {filteredAndSortedColors.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">没有匹配的颜色</p>
          ) : null}
          {filteredAndSortedColors.map((colorInfo) => {
            const progressPercentage = Math.round((colorInfo.completed / colorInfo.total) * 100);
            const isSelected = colorInfo.color === currentColor;
            const isCompleted = progressPercentage === 100;

            return (
              <button
                key={colorInfo.color}
                type="button"
                onClick={() => onColorSelect(colorInfo.color)}
                className={`mb-2 w-full rounded-lg border-2 p-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  isSelected 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-200 bg-white hover:border-gray-300'
                } ${isCompleted ? 'opacity-60' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <ColorSwatch hex={colorInfo.color} size="lg" shape="circle" />
                    <div className="text-left">
                      <div className="text-sm font-medium text-gray-800 font-mono">
                        {colorInfo.name}
                      </div>
                      <div className="text-xs text-gray-500">
                        {colorInfo.completed}/{colorInfo.total} ({progressPercentage}%)
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {isCompleted && (
                      <div className="text-green-500">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                    {isSelected && (
                      <div className="text-blue-500">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </div>
                </div>

                {/* 进度条 */}
                <div className="mt-2 w-full bg-gray-200 rounded-full h-1.5">
                  <div 
                    className={`h-1.5 rounded-full ${
                      isCompleted ? 'bg-green-500' : 'bg-blue-500'
                    }`}
                    style={{ width: `${progressPercentage}%` }}
                  />
                </div>
              </button>
            );
          })}
        </div>

        {/* 关闭按钮 */}
        <div className="p-4 border-t border-gray-200">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-lg bg-gray-500 py-3 text-white hover:bg-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            关闭
          </button>
        </div>
    </Overlay>
  );
};

export default ColorPanel;