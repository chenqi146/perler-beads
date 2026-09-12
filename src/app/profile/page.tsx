'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import RequireAuth from '../../components/RequireAuth';
import { usePatternStore } from '../../stores';
import { listWorks } from '../../utils/platformStore';
import { applyAuthSuccess } from '../../utils/authClient';

type Me = { id: string; email: string | null; name: string | null };

function ProfileContent() {
  const patterns = usePatternStore((s) => s.patterns);
  const refreshPatterns = usePatternStore((s) => s.refreshPatterns);
  const [me, setMe] = useState<Me | null>(null);
  const [name, setName] = useState('');
  const [worksCount, setWorksCount] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    refreshPatterns();
    setWorksCount(listWorks().length);
    void (async () => {
      try {
        const res = await fetch('/api/me', { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();
        setMe(data);
        setName(String(data.name || ''));
        const cloudWorks = await fetch('/api/works', { credentials: 'include' });
        if (cloudWorks.ok) {
          const w = await cloudWorks.json();
          if (Array.isArray(w.works)) setWorksCount(w.works.length);
        }
      } catch {
        // ignore
      }
    })();
  }, [refreshPatterns]);

  const saveName = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/me', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(typeof data.error === 'string' ? data.error : '保存失败');
        return;
      }
      setMe(data);
      if (data.email) {
        applyAuthSuccess({
          id: String(data.id),
          name: String(data.name),
          email: String(data.email),
        });
      } else {
        localStorage.setItem('perler-user-name', String(data.name || name.trim()));
      }
      setMessage('昵称已更新');
    } catch {
      setMessage('网络异常');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="platform-page">
      <header className="platform-header">
        <div>
          <p className="eyebrow">PROFILE</p>
          <h1>个人信息</h1>
        </div>
        <Link href="/dashboard" className="secondary-button">
          我的图纸
        </Link>
      </header>

      <section className="mx-auto max-w-lg rounded-2xl border border-[#eadfce] bg-[#fffaf3] p-6">
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="text-[#8a6a4a]">邮箱</dt>
            <dd className="mt-1 font-medium text-[#3a2416]">{me?.email || '—'}</dd>
          </div>
          <div>
            <dt className="text-[#8a6a4a]">图纸 / 作品</dt>
            <dd className="mt-1 font-medium text-[#3a2416]">
              {patterns.length} 张图纸 · {worksCount} 件作品
            </dd>
          </div>
        </dl>

        <form className="mt-6 space-y-3" onSubmit={saveName}>
          <label className="block text-sm font-medium text-[#5c4030]">
            昵称
            <input
              className="mt-2 h-11 w-full rounded-xl border border-[#e0d0bc] bg-white px-3"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
              required
            />
          </label>
          {message ? <p className="text-sm text-[#8a6a4a]">{message}</p> : null}
          <button type="submit" className="primary-button" disabled={saving}>
            {saving ? '保存中…' : '保存昵称'}
          </button>
        </form>
      </section>
    </main>
  );
}

export default function ProfilePage() {
  return (
    <RequireAuth>
      <ProfileContent />
    </RequireAuth>
  );
}
