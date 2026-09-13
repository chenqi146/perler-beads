'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  listWorks,
  saveWork,
  listSessions,
  createSession,
  listPatterns,
} from '../../utils/platformStore';
import type { Work } from '../../types/platform';
import RequireAuth from '../../components/RequireAuth';
import { apiFetch } from '../../utils/apiClient';
import { useToast } from '../../components/ui/ToastProvider';

function WorksContent() {
  const toast = useToast();
  const [works, setWorks] = useState<Work[]>([]);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [imagePreview, setImagePreview] = useState('');
  const [imageKey, setImageKey] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [publicWork, setPublicWork] = useState(false);
  const [uploading, setUploading] = useState(false);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setImagePreview('');
    setImageKey('');
    setImageUrl('');
    setPublicWork(false);
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
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#3a2416]/40 p-4 overscroll-contain">
          <div className="w-full max-w-md rounded-2xl border border-[#eadfce] bg-[#fffaf3] p-6 shadow-[0_24px_60px_rgba(90,52,24,0.18)]">
            <h2 className="text-xl font-semibold text-[#3a2416]">上传作品</h2>
            <div className="mt-5 space-y-3">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void upload(file);
                }}
              />
              {imagePreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imagePreview}
                  alt="预览"
                  className="max-h-40 rounded-lg object-contain"
                />
              ) : null}
              <input
                className="h-11 w-full rounded-xl border border-[#e0d0bc] bg-white px-3"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="作品标题…"
                autoComplete="off"
              />
              <textarea
                className="min-h-20 w-full rounded-xl border border-[#e0d0bc] bg-white px-3 py-2"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="作品描述…"
                autoComplete="off"
              />
              <label className="flex items-center gap-2 text-sm text-[#5c4030]">
                <input
                  type="checkbox"
                  checked={publicWork}
                  onChange={(event) => setPublicWork(event.target.checked)}
                />
                公开作品
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-3">
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
        </div>
      ) : null}

      <section className="pattern-grid">
        {works.length ? (
          works.map((work) => (
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

export default function WorksPage() {
  return (
    <RequireAuth>
      <WorksContent />
    </RequireAuth>
  );
}
