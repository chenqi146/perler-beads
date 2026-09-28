'use client';

import type { DragEvent } from 'react';

export type EditorUploadPanelProps = {
  originalImageSrc: string | null;
  preAiImageSrc: string | null;
  /** 刚上传、尚未处理的暂存图 */
  stagedUploadSrc?: string | null;
  pendingPrepImageSrc: string | null;
  isImagePrepOpen: boolean;
  isMounted: boolean;
  /** 已有格子图纸但原图尚未恢复时，避免误当成「无内容」 */
  hasPatternGrid?: boolean;
  /** 重新打开处理弹窗（弹窗内选择转像素 / 图纸识别） */
  onStartUploadModeProcess: () => void;
  isRecognizingPattern?: boolean;
  onUndoAiMatting: () => void;
  onTriggerFileInput: () => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
  onDragOver: (event: DragEvent<HTMLDivElement>) => void;
};

/** 左侧「原图与上传」区块：预览（点击换图）/ 拖放上传 */
export function EditorUploadPanel({
  originalImageSrc,
  preAiImageSrc,
  stagedUploadSrc = null,
  pendingPrepImageSrc,
  isImagePrepOpen,
  isMounted,
  hasPatternGrid = false,
  onStartUploadModeProcess,
  isRecognizingPattern = false,
  onUndoAiMatting,
  onTriggerFileInput,
  onDrop,
  onDragOver,
}: EditorUploadPanelProps) {
  const previewSrc = stagedUploadSrc || originalImageSrc;
  const processSource = stagedUploadSrc || preAiImageSrc || originalImageSrc;
  const isAwaitingProcess = Boolean(stagedUploadSrc) && !originalImageSrc;

  return (
    <section className="shrink-0 rounded-xl border border-[#eadfce] bg-white p-3 dark:border-gray-800 dark:bg-gray-900 sm:p-4">
      <h2 className="mb-3 text-sm font-semibold text-[#3a2416] dark:text-gray-100">原图与上传</h2>

      {isRecognizingPattern ? (
        <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50/50 p-6 text-center text-sm text-amber-800 dark:border-amber-700/60 dark:bg-amber-900/20 dark:text-amber-200">
          正在识别图纸…
        </div>
      ) : previewSrc ? (
        <div className="space-y-3">
          <button
            type="button"
            onClick={isMounted ? onTriggerFileInput : undefined}
            className="group relative block w-full overflow-hidden rounded-lg border border-gray-200 bg-gray-50 text-left transition-colors hover:border-amber-300 dark:border-gray-700 dark:bg-gray-900/40 dark:hover:border-amber-700/60"
            aria-label="点击更换图片"
            title="点击更换图片"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewSrc} alt="原图预览，点击更换" className="max-h-28 w-full object-contain" />
            <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/45 to-transparent px-2 py-1.5 text-center text-[11px] font-medium text-white opacity-90 transition-opacity group-hover:opacity-100">
              点击更换图片
            </span>
          </button>

          {processSource ? (
            <button
              type="button"
              onClick={onStartUploadModeProcess}
              className="app-btn app-btn--primary app-btn--block app-btn--sm"
            >
              {isAwaitingProcess ? '继续处理图片' : '重新处理图片'}
            </button>
          ) : null}

          {preAiImageSrc && !stagedUploadSrc && (
            <button
              type="button"
              onClick={onUndoAiMatting}
              className="app-btn app-btn--ghost app-btn--block app-btn--xs"
            >
              用抠图前原图重新处理
            </button>
          )}
        </div>
      ) : hasPatternGrid ? (
        <div className="space-y-3">
          <p className="rounded-lg bg-[#fff4e6] px-3 py-2 text-[11px] leading-relaxed text-[#8a4e18]">
            当前仅有图纸数据，原图未找到。请重新上传后再裁剪；保存后原图会同步到云端，换设备也可恢复。
          </p>
          <button
            type="button"
            onClick={isMounted ? onTriggerFileInput : undefined}
            className="app-btn app-btn--secondary app-btn--block app-btn--sm"
          >
            重新上传原图
          </button>
        </div>
      ) : pendingPrepImageSrc && isImagePrepOpen ? (
        <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50/50 p-4 text-center text-sm text-amber-800">
          请在弹窗中选择模式并完成裁剪后确认
        </div>
      ) : (
        <div
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragEnter={onDragOver}
          onClick={isMounted && !isRecognizingPattern ? onTriggerFileInput : undefined}
          className={`flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-amber-300 bg-amber-50/30 p-6 text-center transition-[border-color,background-color] duration-300 dark:border-amber-700/60 dark:bg-gray-900/20 ${isMounted ? 'cursor-pointer hover:border-amber-400 hover:bg-amber-50/60 dark:hover:bg-amber-900/10' : 'cursor-wait'}`}
          style={{ minHeight: '100px' }}
          role="button"
          tabIndex={0}
          aria-label="上传图片或 CSV"
          onKeyDown={(e) => {
            if (!isMounted || isRecognizingPattern) return;
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onTriggerFileInput();
            }
          }}
        >
          <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-amber-400 text-white shadow-sm">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
          </div>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
            点击、拖拽或粘贴图片到这里
          </p>
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
            上传后将弹出处理窗口，可选择「图片转像素」或「图纸识别」
          </p>
          <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">支持 JPG, PNG, GIF（或 CSV）</p>
        </div>
      )}
    </section>
  );
}
