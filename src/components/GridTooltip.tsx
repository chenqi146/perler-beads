import React from 'react';
import { getDisplayColorKey, ColorSystem } from '../utils/colorSystemUtils';

interface TooltipData {
  x: number;
  y: number;
  key: string;
  color: string;
}

interface GridTooltipProps {
  tooltipData: TooltipData | null;
  selectedColorSystem?: ColorSystem;
}

const GridTooltip: React.FC<GridTooltipProps> = ({ tooltipData, selectedColorSystem = 'MARD' }) => {
  if (!tooltipData) return null;

  return (
    <div
      className="absolute bg-gray-800 text-white text-xs px-2 py-1 rounded shadow-lg pointer-events-none flex items-center space-x-1.5 z-50"
      style={{
        left: `${tooltipData.x}px`,
        top: `${tooltipData.y}px`,
        transform: 'translate(-50%, calc(-100% - 10px))', // 紧贴光标上方
        whiteSpace: 'nowrap',
      }}
    >
      <span
        className="inline-block w-3 h-3 rounded-sm border border-gray-400 dark:border-gray-500 flex-shrink-0"
        style={{ backgroundColor: tooltipData.color }}
      ></span>
      <span className="font-mono font-semibold">{getDisplayColorKey(tooltipData.color, selectedColorSystem)}</span>
    </div>
  );
};

export default GridTooltip; 