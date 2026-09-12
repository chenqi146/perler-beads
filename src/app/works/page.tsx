'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { listWorks, saveWork, listSessions } from '../../utils/platformStore';
import type { Work } from '../../types/platform';
import RequireAuth from '../../components/RequireAuth';

function WorksContent() {
  const [works, setWorks] = useState<Work[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [publicWork, setPublicWork] = useState(false);

  useEffect(() => setWorks(listWorks()), []);

  const upload = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => setImageUrl(String(reader.result));
    reader.readAsDataURL(file);
  };

  const submit = () => {
    const session = listSessions().find((item) => item.status === 'completed') || listSessions()[0];
    if (!session || !title.trim() || !imageUrl) return;
    saveWork({
      patternId: session.patternId,
      craftSessionId: session.id,
      title: title.trim(),
      description,
      tags: [],
      imageUrl,
      visibility: publicWork ? 'public' : 'private',
    });
    setWorks(listWorks());
    setTitle('');
    setDescription('');
    setImageUrl('');
  };

  return (
    <main className="platform-page">
      <header className="platform-header">
        <div>
          <p className="eyebrow">MY WORKS</p>
          <h1>我的作品</h1>
        </div>
      </header>

      <section className="work-upload">
        <h2>上传作品</h2>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) upload(file);
          }}
        />
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
          <input type="checkbox" checked={publicWork} onChange={(event) => setPublicWork(event.target.checked)} />{' '}
          公开作品
        </label>
        <button type="button" className="primary-button" onClick={submit}>
          保存作品
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
