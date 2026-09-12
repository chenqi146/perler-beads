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

function WorksContent() {
  const [works, setWorks] = useState<Work[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [imagePreview, setImagePreview] = useState('');
  const [imageKey, setImageKey] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [publicWork, setPublicWork] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncNote, setSyncNote] = useState<string | null>(null);

  const refresh = async () => {
    try {
      const res = await fetch('/api/works', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        const remote = Array.isArray(data.works) ? (data.works as Work[]) : [];
        setWorks(remote.length ? remote : listWorks());
        setSyncNote(null);
        return;
      }
      if (res.status === 503) setSyncNote('云端未就绪，显示本地作品');
    } catch {
      setSyncNote('网络异常，显示本地作品');
    }
    setWorks(listWorks());
  };

  useEffect(() => {
    void refresh();
  }, []);

  const upload = async (file: File) => {
    setError(null);
    setUploading(true);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(String(reader.result));
    reader.readAsDataURL(file);

    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/uploads', {
        method: 'POST',
        credentials: 'include',
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.key) {
        setImageKey(String(data.key));
        setImageUrl(String(data.url || ''));
      } else if (res.status === 503) {
        // 无 R2：用 data URL 本地保存
        setImageKey('');
        setImageUrl('');
        setSyncNote('R2 未绑定，将仅本地保存作品图');
      } else {
        setError(typeof data.error === 'string' ? data.error : '上传失败');
      }
    } catch {
      setError('上传失败');
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
    setError(null);
    const session = ensureSession();
    if (!session || !title.trim()) {
      setError('请填写标题，并确保有图纸或制作会话');
      return;
    }
    const finalImage = imageKey || imageUrl || imagePreview;
    if (!finalImage) {
      setError('请先选择图片');
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
      const res = await fetch('/api/works', {
        method: 'POST',
        credentials: 'include',
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
      if (!res.ok && res.status !== 503) {
        const data = await res.json().catch(() => ({}));
        setError(typeof data.error === 'string' ? data.error : '云端保存失败，已存本地');
      }
    } catch {
      setSyncNote('云端不可用，已存本地');
    }

    setTitle('');
    setDescription('');
    setImagePreview('');
    setImageKey('');
    setImageUrl('');
    await refresh();
  };

  return (
    <main className="platform-page">
      <header className="platform-header">
        <div>
          <p className="eyebrow">MY WORKS</p>
          <h1>我的作品</h1>
          {syncNote ? <p className="mt-1 text-xs text-[#8a6a4a]">{syncNote}</p> : null}
        </div>
      </header>

      <section className="work-upload">
        <h2>上传作品</h2>
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
          <img src={imagePreview} alt="预览" className="mt-2 max-h-40 rounded-lg object-contain" />
        ) : null}
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="作品标题…"
          autoComplete="off"
        />
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="作品描述…"
          autoComplete="off"
        />
        <label>
          <input
            type="checkbox"
            checked={publicWork}
            onChange={(event) => setPublicWork(event.target.checked)}
          />{' '}
          公开作品
        </label>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button
          type="button"
          className="primary-button"
          onClick={() => void submit()}
          disabled={uploading}
        >
          {uploading ? '上传中…' : '保存作品'}
        </button>
      </section>

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
              <h2>{work.title}</h2>
              <p>{work.description || '暂无描述'}</p>
            </Link>
          ))
        ) : (
          <p className="empty-state">还没有作品，完成后可以在这里上传。</p>
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
