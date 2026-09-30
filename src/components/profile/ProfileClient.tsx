'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { usePatternStore } from '@/stores';
import { listWorks } from '@/utils/platformStore';
import { applyAuthSuccess } from '@/utils/authClient';
import { useToast } from '@/components/ui/ToastProvider';
import { changePasswordAction, updateProfileAction } from '@/app/actions/profile';
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
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    refreshPatterns();
    const localWorks = listWorks().length;
    if (localWorks > worksCount) setWorksCount(localWorks);
  }, [refreshPatterns, worksCount]);

  const patternsCount =
    patterns.length > 0 ? patterns.length : initialPatternsCount;
  const isAnonymous = Boolean(me.isAnonymous) || !me.email;

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
      applyAuthSuccess({
        id: result.user.id,
        name: String(result.user.name || name.trim()),
        email: result.user.email || '',
        isAnonymous: Boolean(result.user.isAnonymous) || !result.user.email,
      });
      toast('昵称已更新');
    } catch {
      toast('网络异常');
    } finally {
      setSaving(false);
    }
  };

  const savePassword = async (event: FormEvent) => {
    event.preventDefault();
    setChangingPassword(true);
    try {
      const result = await changePasswordAction({
        currentPassword,
        newPassword,
        confirmPassword,
      });
      if (!result.ok) {
        toast(result.error || '修改失败');
        return;
      }
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast(result.message || '密码已更新');
    } catch {
      toast('网络异常');
    } finally {
      setChangingPassword(false);
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
        {isAnonymous ? (
          <p className="mb-4 rounded-xl bg-[#f3e6d4] px-3 py-2 text-xs text-[#5c4030]">
            当前是本机游客身份，数据绑在这个浏览器。绑定账号后可跨设备同步。
          </p>
        ) : null}
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="text-[#8a6a4a]">账号</dt>
            <dd className="mt-1 font-medium text-[#3a2416]">
              {isAnonymous ? '本机游客（未绑定）' : me.email || '—'}
            </dd>
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

        {!isAnonymous ? (
          <form
            className="mt-8 space-y-3 border-t border-[#eadfce] pt-6"
            onSubmit={savePassword}
          >
            <h2 className="text-sm font-semibold text-[#3a2416]">修改密码</h2>
            <label className="block text-sm font-medium text-[#5c4030]">
              当前密码
              <input
                type="password"
                autoComplete="current-password"
                className="mt-2 h-11 w-full rounded-xl border border-[#e0d0bc] bg-white px-3"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </label>
            <label className="block text-sm font-medium text-[#5c4030]">
              新密码
              <input
                type="password"
                autoComplete="new-password"
                className="mt-2 h-11 w-full rounded-xl border border-[#e0d0bc] bg-white px-3"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={6}
                required
              />
            </label>
            <label className="block text-sm font-medium text-[#5c4030]">
              确认新密码
              <input
                type="password"
                autoComplete="new-password"
                className="mt-2 h-11 w-full rounded-xl border border-[#e0d0bc] bg-white px-3"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                minLength={6}
                required
              />
            </label>
            <button type="submit" className="primary-button" disabled={changingPassword}>
              {changingPassword ? '提交中…' : '更新密码'}
            </button>
          </form>
        ) : null}

        {isAnonymous ? (
          <Link
            href="/auth/login?next=/profile"
            className="mt-4 inline-flex text-sm font-medium text-[#c47a2c] underline-offset-2 hover:underline"
          >
            绑定账号（跨设备）
          </Link>
        ) : me.isAdmin ? (
          <Link
            href="/admin"
            className="mt-4 inline-flex text-sm font-medium text-[#c47a2c] underline-offset-2 hover:underline"
          >
            进入后台管理
          </Link>
        ) : null}
      </section>
    </main>
  );
}
