'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { usePatternStore } from '@/stores';
import { listWorks } from '@/utils/platformStore';
import { applyAuthSuccess } from '@/utils/authClient';
import { useToast } from '@/components/ui/ToastProvider';
import { updateProfileAction } from '@/app/actions/profile';
import type { SessionUser } from '@/lib/auth';

type Props = {
  initialUser: SessionUser;
  initialWorksCount: number;
  initialPatternsCount: number;
};

export function ProfileClient({
  initialUser,
  initialWorksCount,
  initialPatternsCount,
}: Props) {
  const toast = useToast();
  const patterns = usePatternStore((s) => s.patterns);
  const refreshPatterns = usePatternStore((s) => s.refreshPatterns);
  const [me, setMe] = useState<SessionUser>(initialUser);
  const [name, setName] = useState(initialUser.name || '');
  const [worksCount, setWorksCount] = useState(initialWorksCount);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    refreshPatterns();
    const localWorks = listWorks().length;
    if (localWorks > worksCount) setWorksCount(localWorks);
  }, [refreshPatterns, worksCount]);

  const patternsCount =
    patterns.length > 0 ? patterns.length : initialPatternsCount;

  const saveName = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const result = await updateProfileAction(name.trim());
      if (!result.ok) {
        toast(result.error || '保存失败');
        return;
      }
      setMe(result.user);
      if (result.user.email) {
        applyAuthSuccess({
          id: result.user.id,
          name: String(result.user.name || name.trim()),
          email: result.user.email,
        });
      } else {
        localStorage.setItem('perler-user-name', String(result.user.name || name.trim()));
      }
      toast('昵称已更新');
    } catch {
      toast('网络异常');
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
            <dt className="text-[#8a6a4a]">账号</dt>
            <dd className="mt-1 font-medium text-[#3a2416]">{me.email || '—'}</dd>
          </div>
          <div>
            <dt className="text-[#8a6a4a]">图纸 / 作品</dt>
            <dd className="mt-1 font-medium text-[#3a2416]">
              {patternsCount} 张图纸 · {worksCount} 件作品
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
          <button type="submit" className="primary-button" disabled={saving}>
            {saving ? '保存中…' : '保存昵称'}
          </button>
        </form>
      </section>
    </main>
  );
}
