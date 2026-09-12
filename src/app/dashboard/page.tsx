'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePatternStore } from '../../stores';
import RequireAuth from '../../components/RequireAuth';

function DashboardContent() {
  const router = useRouter();
  const patterns = usePatternStore((s) => s.patterns);
  const refreshPatterns = usePatternStore((s) => s.refreshPatterns);
  const savePattern = usePatternStore((s) => s.savePattern);
  const deletePattern = usePatternStore((s) => s.deletePattern);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    refreshPatterns();
  }, [refreshPatterns]);

  const create = () => {
    if (!name.trim()) return;
    const raw = savePattern({
      name: name.trim(),
      description,
      tags: [],
      visibility: 'private',
      data: {
        mappedPixelData: [],
        gridDimensions: { N: 0, M: 0 },
        colorCounts: null,
        totalBeadCount: 0,
        originalImageSrc: null,
        selectedColorSystem: 'MARD',
      },
    });
    router.push(`/editor/${raw.id}`);
  };

  return (
    <main className="platform-page">
      <header className="platform-header">
        <div>
          <p className="eyebrow">MY PATTERNS</p>
          <h1>我的图纸</h1>
        </div>
        <button type="button" className="primary-button" onClick={() => setOpen(true)}>
          新建图纸
        </button>
      </header>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#3a2416]/40 p-4 overscroll-contain">
          <div className="w-full max-w-md rounded-2xl border border-[#eadfce] bg-[#fffaf3] p-6 shadow-[0_24px_60px_rgba(90,52,24,0.18)]">
            <h2 className="text-xl font-semibold text-[#3a2416]">创建图纸</h2>
            <label className="mt-5 block text-sm font-medium text-[#5c4030]">
              图纸名称
              <input
                className="mt-2 h-11 w-full rounded-xl border border-[#e0d0bc] bg-white px-3 focus-visible:border-[#c47a2c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e8b86a]"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="off"
                autoFocus
              />
            </label>
            <label className="mt-4 block text-sm font-medium text-[#5c4030]">
              描述
              <textarea
                className="mt-2 min-h-20 w-full rounded-xl border border-[#e0d0bc] bg-white px-3 py-2 focus-visible:border-[#c47a2c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e8b86a]"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                autoComplete="off"
              />
            </label>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" className="secondary-button" onClick={() => setOpen(false)}>
                取消
              </button>
              <button type="button" className="primary-button" onClick={create}>
                创建并编辑
              </button>
            </div>
          </div>
        </div>
      )}

      <section className="pattern-grid">
        {patterns.length ? (
          patterns.map((pattern) => (
            <article className="pattern-card" key={pattern.id}>
              <Link href={`/editor/${pattern.id}`} className="pattern-preview">
                {pattern.data.originalImageSrc && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={pattern.data.originalImageSrc} alt="" />
                )}
              </Link>
              <h2>{pattern.name}</h2>
              <p>{pattern.description || '暂无描述'}</p>
              <small>
                {pattern.visibility === 'public' ? '公开' : '私有'} · {pattern.data.gridDimensions.N} ×{' '}
                {pattern.data.gridDimensions.M}
              </small>
              <div className="detail-actions">
                <Link href={`/editor/${pattern.id}`} className="secondary-button">
                  编辑
                </Link>
                <Link
                  href={`/bead/${pattern.id}`}
                  className={`primary-button ${pattern.data.gridDimensions.N <= 0 ? 'pointer-events-none opacity-40' : ''}`}
                  aria-disabled={pattern.data.gridDimensions.N <= 0}
                >
                  开始拼豆
                </Link>
                <button
                  type="button"
                  className="platform-link danger"
                  onClick={() => {
                    deletePattern(pattern.id);
                  }}
                >
                  删除
                </button>
              </div>
            </article>
          ))
        ) : (
          <p className="empty-state">还没有图纸，先新建一张吧。</p>
        )}
      </section>
    </main>
  );
}

export default function Dashboard() {
  return (
    <RequireAuth>
      <DashboardContent />
    </RequireAuth>
  );
}
