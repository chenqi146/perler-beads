'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { applyAuthSuccess } from '@/utils/authClient';
import { useToast } from '@/components/ui/ToastProvider';

function loginNextPath() {
  if (typeof window === 'undefined') return '/dashboard';
  return new URLSearchParams(window.location.search).get('next') || '/dashboard';
}

export default function LoginPage() {
  const router = useRouter();
  const toast = useToast();
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!account.trim() || !password) return;
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ account: account.trim(), password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 503 && process.env.NODE_ENV === 'development') {
          const fallbackId = `user_${account.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/gi, '-')}`;
          applyAuthSuccess({
            id: fallbackId,
            name: account.trim() || '拼豆玩家',
            email: account.trim(),
          });
          toast('开发模式：已本地登录（无 D1）');
          router.push(loginNextPath());
          return;
        }
        toast(typeof data.error === 'string' ? data.error : '登录失败');
        return;
      }
      applyAuthSuccess({
        id: String(data.id),
        name: String(data.name || account.trim() || '拼豆玩家'),
        email: String(data.account || data.email || account.trim()),
      });
      toast('登录成功');
      router.push(loginNextPath());
    } catch {
      toast('网络异常，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="platform-page auth-page">
      <form className="auth-form" onSubmit={submit}>
        <p className="eyebrow">WELCOME BACK</p>
        <h1>登录</h1>
        <p>登录后可保存图纸、管理作品。</p>
        <label htmlFor="login-account">
          账号
          <input
            id="login-account"
            name="username"
            type="text"
            autoComplete="username"
            spellCheck={false}
            value={account}
            onChange={(event) => setAccount(event.target.value)}
            placeholder="注册时填写的账号"
            required
          />
        </label>
        <label htmlFor="login-password">
          密码
          <input
            id="login-password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="密码"
            required
          />
        </label>
        <button className="primary-button" type="submit" disabled={loading}>
          {loading ? '登录中…' : '登录'}
        </button>
        <Link href="/auth/register" className="platform-link">
          注册新账号
        </Link>
      </form>
    </main>
  );
}
