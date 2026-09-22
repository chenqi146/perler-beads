'use client';

import type { ChangeEvent, DragEvent, RefObject } from 'react';

export type EditorUploadPanelProps = {
  originalImageSrc: string | null;
  preAiImageSrc: string | null;
  pendingPrepImageSrc: string | null;
  isImagePrepOpen: boolean;
  isMounted: boolean;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onOpenImagePrep: (src: string) => void;
  onUndoAiMatting: () => void;
  onTriggerFileInput: () => void;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
  onDragOver: (event: DragEvent<HTMLDivElement>) => void;
};

/** 左侧「原图与上传」区块：预览 / 更换图片 / 拖放上传 */
export function EditorUploadPanel({
  originalImageSrc,
  preAiImageSrc,
  pendingPrepImageSrc,
  isImagePrepOpen,
  isMounted,
  fileInputRef,
  onOpenImagePrep,
  onUndoAiMatting,
  onTriggerFileInput,
  onFileChange,
  onDrop,
  onDragOver,
}: EditorUploadPanelProps) {
  return (
    <section className="shrink-0 rounded-xl border border-[#eadfce] bg-white p-3 dark:border-gray-800 dark:bg-gray-900 sm:p-4">
      <h2 className="mb-3 text-sm font-semibold text-[#3a2416] dark:text-gray-100">原图与上传</h2>
      {originalImageSrc ? (
        <div className="space-y-3">
          <div className="relative rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={originalImageSrc} alt="原图预览" className="w-full max-h-28 object-contain" />
          </div>
          <button
            type="button"
            onClick={() => onOpenImagePrep(preAiImageSrc || originalImageSrc)}
            className="app-btn app-btn--soft app-btn--block app-btn--sm"
          >
            重新裁剪 / 抠图
          </button>
          {preAiImageSrc && (
            <button
              type="button"
              onClick={onUndoAiMatting}
              className="app-btn app-btn--ghost app-btn--block app-btn--xs"
            >
              用抠图前原图重新处理
            </button>
          )}
          <button
            type="button"
            onClick={isMounted ? onTriggerFileInput : undefined}
            className="app-btn app-btn--secondary app-btn--block app-btn--sm"
          >
            更换图片
          </button>
        </div>
      ) : pendingPrepImageSrc && isImagePrepOpen ? (
        <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50/50 p-4 text-center text-sm text-amber-800">
          请在弹窗中完成裁剪 / 抠图后确认
        </div>
      ) : (
        <div
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragEnter={onDragOver}
          onClick={isMounted ? onTriggerFileInput : undefined}
          className={`border-2 border-dashed border-amber-300 dark:border-amber-700/60 rounded-xl p-6 text-center ${isMounted ? 'cursor-pointer hover:border-amber-400 hover:bg-amber-50/60 dark:hover:bg-amber-900/10' : 'cursor-wait'} transition-[border-color,background-color] duration-300 w-full flex flex-col justify-center items-center bg-amber-50/30 dark:bg-gray-900/20`}
          style={{ minHeight: '100px' }}
          role="button"
          tabIndex={0}
          aria-label="上传图片或 CSV"
          onKeyDown={(e) => {
            if (!isMounted) return;
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
          <p className="text-sm text-gray-700 dark:text-gray-200 font-medium">点击、拖拽或粘贴图片到这里</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">支持 JPG, PNG, GIF（或 CSV）</p>
        </div>
      )}
      <input
        type="file"
        accept="image/jpeg, image/png, image/gif, .csv, text/csv, application/csv, text/plain"
        onChange={onFileChange}
        ref={fileInputRef}
        className="hidden"
      />
    </section>
  );
}
