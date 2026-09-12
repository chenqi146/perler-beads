'use client';

import React, { useId } from 'react';
import { Overlay } from './ui/Overlay';
import type { Visibility } from '../types/platform';

type PatternSaveModalProps = {
  open: boolean;
  name: string;
  description: string;
  visibility: Visibility;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onVisibilityChange: (value: Visibility) => void;
  onClose: () => void;
  onSave: () => void;
};

function parseVisibility(value: string): Visibility {
  return value === 'public' ? 'public' : 'private';
}

export default function PatternSaveModal({
  open,
  name,
  description,
  visibility,
  onNameChange,
  onDescriptionChange,
  onVisibilityChange,
  onClose,
  onSave,
}: PatternSaveModalProps) {
  const titleId = useId();
  const nameId = useId();
  const descId = useId();
  const visibilityId = useId();

  if (!open) {
    return null;
  }

  return (
    <Overlay
      labelledBy={titleId}
      onClose={onClose}
      layer="import"
      panelClassName="w-full max-w-md overflow-y-auto overscroll-contain rounded-2xl border border-[#e8ddd0] bg-[#fffaf3] p-6 shadow-[0_24px_60px_rgba(90,52,24,0.18)]"
    >
      <div className="space-y-5">
        <header className="space-y-1">
          <p className="text-[11px] font-semibold tracking-[0.14em] text-[#b07a3a]">PATTERN</p>
          <h2 id={titleId} className="text-wrap text-xl font-semibold tracking-tight text-[#3a2416]">
            保存图纸
          </h2>
          <p className="text-sm leading-relaxed text-[#8a6a4a]">
            保存后可在「我的图纸」继续编辑。
          </p>
        </header>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor={nameId} className="block text-sm font-medium text-[#5c4030]">
              图纸名称
            </label>
            <input
              id={nameId}
              name="patternName"
              autoComplete="off"
              spellCheck={false}
              value={name}
              onChange={(event) => onNameChange(event.target.value)}
              placeholder="例如：猫咪头像…"
              className="h-11 w-full rounded-xl border border-[#e0d0bc] bg-white px-3 text-sm text-[#3a2416] placeholder:text-[#c4a882] transition-[border-color,box-shadow] duration-150 focus-visible:border-[#c47a2c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e8b86a]"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor={descId} className="block text-sm font-medium text-[#5c4030]">
              描述
            </label>
            <textarea
              id={descId}
              name="patternDescription"
              autoComplete="off"
              value={description}
              onChange={(event) => onDescriptionChange(event.target.value)}
              placeholder="可选：记录用色、尺寸或备注…"
              rows={3}
              className="min-h-20 w-full resize-y rounded-xl border border-[#e0d0bc] bg-white px-3 py-2.5 text-sm text-[#3a2416] placeholder:text-[#c4a882] transition-[border-color,box-shadow] duration-150 focus-visible:border-[#c47a2c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e8b86a]"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor={visibilityId} className="block text-sm font-medium text-[#5c4030]">
              可见性
            </label>
            <select
              id={visibilityId}
              name="patternVisibility"
              value={visibility}
              onChange={(event) => onVisibilityChange(parseVisibility(event.target.value))}
              className="h-11 w-full rounded-xl border border-[#e0d0bc] bg-white px-3 text-sm text-[#3a2416] transition-[border-color,box-shadow] duration-150 focus-visible:border-[#c47a2c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e8b86a]"
            >
              <option value="private">私有</option>
              <option value="public">公开</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-xl border border-[#e0d0bc] bg-white px-4 text-sm font-medium text-[#6b5340] transition-[background-color,border-color] duration-150 hover:bg-[#fff4e6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e8b86a]"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onSave}
            className="h-10 rounded-xl bg-[#c47a2c] px-4 text-sm font-semibold text-white shadow-[0_8px_18px_rgba(196,122,44,0.28)] transition-[background-color,transform] duration-150 hover:bg-[#b06b22] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e8b86a] focus-visible:ring-offset-2 active:scale-[0.98]"
          >
            保存图纸
          </button>
        </div>
      </div>
    </Overlay>
  );
}
