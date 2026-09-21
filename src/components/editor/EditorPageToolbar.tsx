'use client';

import type { AutosaveStatus } from '../../stores';
import { IconButton } from '../ui/IconButton';

type EditorPageToolbarProps = {
  onStartBeading: () => void;
  onSave: () => void;
  onExport?: () => void;
  canExport?: boolean;
  autosaveStatus?: AutosaveStatus;
  /** 有 patternId 时才显示自动保存状态 */
  showAutosave?: boolean;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
};

function autosaveLabel(status: AutosaveStatus): string | null {
  switch (status) {
    case 'saving':
      return '自动保存中…';
    case 'saved':
      return '已自动保存';
    case 'error':
      return '自动保存失败';
    default:
      return null;
  }
}

/** 编辑页内操作栏：撤销重做 / 保存 / 开始拼豆（不放进 Nav） */
export function EditorPageToolbar({
  onStartBeading,
  onSave,
  onExport,
  canExport = false,
  autosaveStatus = 'idle',
  showAutosave = false,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
}: EditorPageToolbarProps) {
  const hint = showAutosave ? autosaveLabel(autosaveStatus) : null;

  return (
    <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5 sm:gap-2">
      {(onUndo || onRedo) && (
        <div className="flex items-center rounded-xl border border-[#e0d0bc] bg-white px-0.5">
          <IconButton
            aria-label="撤销"
            title="撤销"
            disabled={!canUndo || !onUndo}
            onClick={onUndo}
            className="max-lg:h-11 max-lg:w-11"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 14L4 9m0 0l5-5M4 9h11a4 4 0 010 8h-1" />
            </svg>
          </IconButton>
          <IconButton
            aria-label="重做"
            title="重做"
            disabled={!canRedo || !onRedo}
            onClick={onRedo}
            className="max-lg:h-11 max-lg:w-11"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 14l5-5m0 0l-5-5m5 5H9a4 4 0 000 8h1" />
            </svg>
          </IconButton>
        </div>
      )}
      {hint && (
        <span
          className={`hidden text-[11px] sm:inline ${
            autosaveStatus === 'error' ? 'text-red-600' : 'text-[#a08060]'
          }`}
          aria-live="polite"
        >
          {hint}
        </span>
      )}
      <button
        type="button"
        onClick={onStartBeading}
        className="inline-flex h-9 touch-manipulation items-center gap-1.5 rounded-xl border border-[#e0d0bc] bg-white px-3 text-sm font-semibold text-[#5c4030] transition-[background-color] duration-150 hover:bg-[#fff4e6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e8b86a] focus-visible:ring-offset-2 focus-visible:ring-offset-white max-lg:h-11"
      >
        开始拼豆
      </button>
      <button
        type="button"
        onClick={onSave}
        className="inline-flex h-9 touch-manipulation items-center gap-1.5 rounded-xl border border-[#e0d0bc] bg-white px-3 text-sm font-semibold text-[#5c4030] transition-[background-color] duration-150 hover:bg-[#fff4e6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e8b86a] focus-visible:ring-offset-2 focus-visible:ring-offset-white max-lg:h-11"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
          <path d="M3 3.75A1.75 1.75 0 014.75 2h7.086c.464 0 .909.184 1.237.513l2.414 2.414c.329.328.513.773.513 1.237v9.086A1.75 1.75 0 0114.25 17h-9.5A1.75 1.75 0 013 15.25V3.75zm8.75 1a.25.25 0 00-.25-.25h-5.5a.25.25 0 00-.25.25v3.5c0 .138.112.25.25.25h5.5a.25.25 0 00.25-.25v-3.5zM6.5 12.25a.75.75 0 01.75-.75h5.5a.75.75 0 01.75.75v3.25h-7V12.25z" />
        </svg>
        保存
      </button>
      {onExport && (
        <button
          type="button"
          onClick={onExport}
          disabled={!canExport}
          className="inline-flex h-9 touch-manipulation items-center gap-1.5 rounded-xl bg-[#c47a2c] px-3 text-sm font-semibold text-white shadow-[0_8px_18px_rgba(196,122,44,0.22)] transition-[background-color,transform,box-shadow,opacity] duration-150 hover:bg-[#b06b22] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e8b86a] focus-visible:ring-offset-2 focus-visible:ring-offset-white active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 max-lg:h-11"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          导出
        </button>
      )}
    </div>
  );
}
