'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import {
  listWorks,
  saveWork,
  listSessions,
  createSession,
  listPatterns,
} from '@/utils/platformStore';
import type { Work } from '@/types/platform';
import { apiFetch } from '@/utils/apiClient';
import { useToast } from '@/components/ui/ToastProvider';
import { Overlay } from '@/components/ui/Overlay';

type Props = {
  initialWorks: Work[];
  cloudAvailable: boolean;
};

export function WorksClient({ initialWorks, cloudAvailable }: Props) {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [works, setWorks] = useState<Work[]>(initialWorks);
  const [hydrated, setHydrated] = useState(false);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [imagePreview, setImagePreview] = useState('');
  const [imageKey, setImageKey] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [fileName, setFileName] = useState('');
  const [publicWork, setPublicWork] = useState(false);
  const [uploading, setUploading] = useState(false);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setImagePreview('');
    setImageKey('');
    setImageUrl('');
    setFileName('');
    setPublicWork(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const closeModal = () => {
    setOpen(false);
    resetForm();
  };

  const refresh = async () => {
    try {
      const res = await apiFetch('/api/works');
      if (res.ok) {
        const data = await res.json();
        const remote = Array.isArray(data.works) ? (data.works as Work[]) : [];
        setWorks(remote.length ? remote : listWorks());
        return;
      }
      if (res.status === 503) {
        toast('云端未就绪，显示本地作品');
      }
    } catch {
      toast('网络异常，显示本地作品');
    }
    setWorks(listWorks());
  };

  useEffect(() => {
    void (async () => {
      if (!cloudAvailable || initialWorks.length === 0) {
        const local = listWorks();
        if (local.length && initialWorks.length === 0) {
          setWorks(local);
          if (!cloudAvailable) toast('云端未就绪，显示本地作品');
        }
      }
      await refresh();
      setHydrated(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const displayWorks = hydrated || works.length > 0 ? works : initialWorks;

  const upload = async (file: File) => {
    setUploading(true);
    setFileName(file.name);
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
        toast('图片已上传');
      } else if (res.status === 503) {
        setImageKey('');
        setImageUrl('');
        toast('R2 未绑定，将仅本地保存作品图');
      } else if (res.status !== 401) {
        toast(typeof data.error === 'string' ? data.error : '上传失败');
      }
    } catch {
      toast('上传失败');
    } finally {
      setUploading(false);
    }
  };

  const ensureSession = () => {
    const existing = listSessions().find((item) => item.status === 'completed') || listSessions()[0];
    if (existing) return existing;
    const pattern = listPatterns()[0];
    if (!pattern) return null;
    return createSession(pattern);
  };

  const submit = async () => {
    const session = ensureSession();
    if (!session || !title.trim()) {
      toast('请填写标题，并确保有图纸或制作会话');
      return;
    }
    const finalImage = imageKey || imageUrl || imagePreview;
    if (!finalImage) {
      toast('请先选择图片');
      return;
    }

    const local = saveWork({
      patternId: session.patternId,
      craftSessionId: session.id,
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
      if (res.ok) toast('作品已保存');
      else if (res.status === 503) toast('云端不可用，已存本地');
      else if (res.status !== 401) {
        const data = await res.json().catch(() => ({}));
        toast(typeof data.error === 'string' ? data.error : '云端保存失败，已存本地');
      }
    } catch {
      toast('云端不可用，已存本地');
    }

    closeModal();
    await refresh();
  };

  return (
    <main className="platform-page">
      <header className="platform-header">
        <div>
          <p className="eyebrow">MY WORKS</p>
          <h1>我的作品</h1>
        </div>
        <button type="button" className="primary-button" onClick={() => setOpen(true)}>
          上传作品
        </button>
      </header>

      {open ? (
        <Overlay
          labelledBy="upload-work-title"
          placement="center"
          onClose={closeModal}
          panelClassName="max-w-md border border-[#eadfce] bg-[#fffaf3] shadow-[0_24px_60px_rgba(90,52,24,0.18)]"
        >
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="flex shrink-0 items-center justify-between border-b border-[#eadfce] px-5 py-4">
              <h2 id="upload-work-title" className="text-lg font-semibold text-[#3a2416]">
                上传作品
              </h2>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg px-2 py-1 text-sm text-[#8a6a4a] transition-colors hover:bg-[#f3e6d4] hover:text-[#3a2416]"
              >
                关闭
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void upload(file);
                }}
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className={[
                  'group flex w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed px-4 py-6 text-center transition-colors',
                  imagePreview
                    ? 'border-[#eadfce] bg-white'
                    : 'border-[#e0d0bc] bg-[#fff8f0] hover:border-[#c47a2c] hover:bg-[#fff4e6]',
                ].join(' ')}
              >
                {imagePreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={imagePreview}
                    alt="预览"
                    className="max-h-44 w-full rounded-xl object-contain"
                  />
                ) : (
                  <>
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#f3e6d4] text-lg text-[#c47a2c]">
                      +
                    </span>
                    <span className="text-sm font-medium text-[#3a2416]">点击选择或拍照</span>
                    <span className="text-xs text-[#a08060]">支持 JPG / PNG</span>
                  </>
                )}
                {imagePreview ? (
                  <span className="text-xs text-[#a08060]">
                    {uploading ? '上传中…' : fileName || '点击可更换图片'}
                  </span>
                ) : null}
              </button>

              <label className="block text-sm font-medium text-[#5c4030]">
                标题
                <input
                  className="mt-1.5 h-11 w-full rounded-xl border border-[#e0d0bc] bg-white px-3 text-[#3a2416] placeholder:text-[#c4b09a] focus-visible:border-[#c47a2c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e8b86a]"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="作品标题…"
                  autoComplete="off"
                />
              </label>

              <label className="block text-sm font-medium text-[#5c4030]">
                描述
                <textarea
                  className="mt-1.5 min-h-20 w-full rounded-xl border border-[#e0d0bc] bg-white px-3 py-2 text-[#3a2416] placeholder:text-[#c4b09a] focus-visible:border-[#c47a2c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e8b86a]"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="可选描述…"
                  autoComplete="off"
                />
              </label>

              <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm text-[#5c4030]">
                <input
                  type="checkbox"
                  checked={publicWork}
                  onChange={(event) => setPublicWork(event.target.checked)}
                  className="h-5 w-5 rounded border-[#e0d0bc] accent-[#c47a2c]"
                />
                公开作品
              </label>
            </div>

            <div className="flex shrink-0 justify-end gap-3 border-t border-[#eadfce] px-5 py-4">
              <button type="button" className="secondary-button" onClick={closeModal}>
                取消
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={() => void submit()}
                disabled={uploading}
              >
                {uploading ? '上传中…' : '保存作品'}
              </button>
            </div>
          </div>
        </Overlay>
      ) : null}

      <section className="pattern-grid">
        {displayWorks.length ? (
          displayWorks.map((work) => (
            <Link href={`/work/${work.id}`} className="pattern-card" key={work.id}>
              <div className="pattern-preview">
                {work.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={work.imageUrl} alt={work.title} />
                )}
              </div>
              <div className="pattern-card-body pattern-card-body--padded">
                <h2>{work.title}</h2>
                {work.description ? <p>{work.description}</p> : null}
              </div>
            </Link>
          ))
        ) : (
          <p className="empty-state">还没有作品，点击右上角「上传作品」。</p>
        )}
      </section>
    </main>
  );
}
