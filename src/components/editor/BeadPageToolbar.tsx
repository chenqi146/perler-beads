'use client';

import Link from 'next/link';

type BeadPageToolbarProps = {
  patternId: string;
  onFitCanvas: () => void;
};

/** 拼豆页内操作栏：返回编辑 / 适应画布（不放进 Nav） */
export function BeadPageToolbar({ patternId, onFitCanvas }: BeadPageToolbarProps) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <Link
        href={`/?patternId=${encodeURIComponent(patternId)}`}
        className="inline-flex h-9 items-center rounded-xl border border-[#e0d0bc] bg-white px-3 text-sm font-medium text-[#5c4030] transition-[background-color] duration-150 hover:bg-[#fff4e6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e8b86a]"
      >
        返回编辑
      </Link>
      <button
        type="button"
        onClick={onFitCanvas}
        className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#c47a2c] px-3 text-sm font-semibold text-white shadow-[0_8px_18px_rgba(196,122,44,0.22)] transition-[background-color] duration-150 hover:bg-[#b06b22] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e8b86a]"
      >
        适应画布
      </button>
    </div>
  );
}
