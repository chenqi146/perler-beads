'use client';

import { useState } from 'react';
import { Overlay } from '../ui/Overlay';
import { apiFetch } from '../../utils/apiClient';
import { saveWork } from '../../utils/platformStore';
import {
  getLocalCraftSessionId,
  pushCraftSession,
} from '../../utils/craftSessionSync';
import type { Pattern } from '../../types/platform';

export type BeadWorkPhotoSheetProps = {
  open: boolean;
  onClose: () => void;
  pattern: Pattern;
  completedCells: string[];
  allDone: boolean;
  onToast: (message: string) => void;
  onSaved?: () => void;
};

/** 拼豆页内拍照/上传作品，关联当前图纸与 craft session */
export function BeadWorkPhotoSheet({
  open,
  onClose,
  pattern,
  completedCells,
  allDone,
  onToast,
  onSaved,
}: BeadWorkPhotoSheetProps) {
  const [title, setTitle] = useState(pattern.name ? `${pattern.name} 成品` : '');
  const [description, setDescription] = useState('');
  const [imagePreview, setImagePreview] = useState('');
  const [imageKey, setImageKey] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [publicWork, setPublicWork] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const resetAndClose = () => {
    setTitle(pattern.name ? `${pattern.name} 成品` : '');
    setDescription('');
    setImagePreview('');
    setImageKey('');
    setImageUrl('');
    setPublicWork(false);
    onClose();
  };

  const upload = async (file: File) => {
    setUploading(true);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(String(reader.result));
    reader.readAsDataURL(file);

    try {
      const form = new FormData();
      form.append('file', file);
      const res = await apiFetch('/api/uploads', { method: 'POST', body: form });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.key) {
        setImageKey(String(data.key));
        setImageUrl(String(data.url || ''));
        onToast('图片已上传');
      } else if (res.status === 503) {
        setImageKey('');
        setImageUrl('');
        onToast('云端存储未就绪，将仅本地保存');
      } else if (res.status !== 401) {
        onToast(typeof data.error === 'string' ? data.error : '上传失败');
      }
    } catch {
      onToast('上传失败');
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    if (!title.trim()) {
      onToast('请填写作品标题');
      return;
    }
    const finalImage = imageKey || imageUrl || imagePreview;
    if (!finalImage) {
      onToast('请先拍照或选择图片');
      return;
    }

    setSaving(true);
    try {
      let craftSessionId = getLocalCraftSessionId(pattern.id);
      if (!craftSessionId) {
        craftSessionId = await pushCraftSession({
          patternId: pattern.id,
          completedCells,
          status: allDone ? 'completed' : 'active',
          patternSnapshot: pattern.data,
        });
      }
      if (!craftSessionId) {
        onToast('无法创建制作会话，请稍后重试');
        return;
      }

      const local = saveWork({
        patternId: pattern.id,
        craftSessionId,
        title: title.trim(),
        description,
        tags: [],
        imageUrl: imageUrl || imagePreview || finalImage,
        visibility: publicWork ? 'public' : 'private',
      });

      try {
        const res = await apiFetch('/api/works', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: local.id,
            title: local.title,
            description: local.description,
            tags: local.tags,
            visibility: local.visibility,
            patternId: local.patternId,
            craftSessionId: local.craftSessionId,
            imageKey: imageKey || finalImage,
          }),
        });
        if (res.ok) onToast('作品已保存');
        else if (res.status === 503) onToast('云端不可用，已存本地');
        else if (res.status !== 401) {
          const data = await res.json().catch(() => ({}));
          onToast(typeof data.error === 'string' ? data.error : '云端保存失败，已存本地');
        }
      } catch {
        onToast('云端不可用，已存本地');
      }

      onSaved?.();
      resetAndClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Overlay labelledBy="bead-work-photo-title" placement="sheet" onClose={resetAndClose}>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex shrink-0 items-center justify-between border-b border-[#eadfce] px-4 py-3">
          <h2 id="bead-work-photo-title" className="text-base font-semibold text-[#3a2416]">
            {allDone ? '拍下完成作品' : '拍照留档'}
          </h2>
          <button
            type="button"
            onClick={resetAndClose}
            className="inline-flex h-11 min-w-11 touch-manipulation items-center justify-center rounded-xl text-sm text-[#8a6a4a]"
          >
            关闭
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-4">
          <label className="flex min-h-11 cursor-pointer flex-col gap-2">
            <span className="text-sm font-medium text-[#5c4030]">照片</span>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="block w-full text-sm text-[#5c4030] file:mr-3 file:rounded-xl file:border-0 file:bg-[#c47a2c] file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void upload(file);
              }}
            />
          </label>
          {imagePreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imagePreview}
              alt="预览"
              className="max-h-48 w-full rounded-xl object-contain ring-1 ring-[#eadfce]"
            />
          ) : null}
          <label className="block text-sm font-medium text-[#5c4030]">
            标题
            <input
              className="mt-1.5 h-11 w-full rounded-xl border border-[#e0d0bc] bg-white px-3 focus-visible:border-[#c47a2c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e8b86a]"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="作品标题…"
              autoComplete="off"
            />
          </label>
          <label className="block text-sm font-medium text-[#5c4030]">
            描述
            <textarea
              className="mt-1.5 min-h-20 w-full rounded-xl border border-[#e0d0bc] bg-white px-3 py-2 focus-visible:border-[#c47a2c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e8b86a]"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="可选描述…"
              autoComplete="off"
            />
          </label>
          <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-[#5c4030]">
            <input
              type="checkbox"
              checked={publicWork}
              onChange={(e) => setPublicWork(e.target.checked)}
              className="h-5 w-5 rounded border-[#e0d0bc] accent-[#c47a2c]"
            />
            公开作品
          </label>
        </div>
        <div
          className="flex shrink-0 gap-3 border-t border-[#eadfce] px-4 py-3"
          style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
        >
          <button
            type="button"
            className="secondary-button h-11 flex-1 touch-manipulation"
            onClick={resetAndClose}
          >
            取消
          </button>
          <button
            type="button"
            className="primary-button h-11 flex-1 touch-manipulation"
            disabled={uploading || saving}
            onClick={() => void submit()}
          >
            {saving ? '保存中…' : uploading ? '上传中…' : '保存作品'}
          </button>
        </div>
      </div>
    </Overlay>
  );
}
