'use client';

type EditorPageToolbarProps = {
  onStartBeading: () => void;
  onSave: () => void;
};

/** 编辑页内操作栏：保存 / 开始拼豆（不放进 Nav） */
export function EditorPageToolbar({ onStartBeading, onSave }: EditorPageToolbarProps) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <button
        type="button"
        onClick={onStartBeading}
        className="inline-flex h-9 touch-manipulation items-center gap-1.5 rounded-xl border border-[#e0d0bc] bg-white px-3 text-sm font-semibold text-[#5c4030] transition-[background-color] duration-150 hover:bg-[#fff4e6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e8b86a] focus-visible:ring-offset-2 focus-visible:ring-offset-white"
      >
        开始拼豆
      </button>
      <button
        type="button"
        onClick={onSave}
        className="inline-flex h-9 touch-manipulation items-center gap-1.5 rounded-xl bg-[#c47a2c] px-3 text-sm font-semibold text-white shadow-[0_8px_18px_rgba(196,122,44,0.22)] transition-[background-color,transform,box-shadow] duration-150 hover:bg-[#b06b22] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e8b86a] focus-visible:ring-offset-2 focus-visible:ring-offset-white active:scale-[0.98]"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
          <path d="M3 3.75A1.75 1.75 0 014.75 2h7.086c.464 0 .909.184 1.237.513l2.414 2.414c.329.328.513.773.513 1.237v9.086A1.75 1.75 0 0114.25 17h-9.5A1.75 1.75 0 013 15.25V3.75zm8.75 1a.25.25 0 00-.25-.25h-5.5a.25.25 0 00-.25.25v3.5c0 .138.112.25.25.25h5.5a.25.25 0 00.25-.25v-3.5zM6.5 12.25a.75.75 0 01.75-.75h5.5a.75.75 0 01.75.75v3.25h-7V12.25z" />
        </svg>
        保存图纸
      </button>
    </div>
  );
}
