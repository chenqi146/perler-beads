'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { applyAuthSuccess } from '@/utils/authClient';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // 仅开发环境在无 D1 时允许本地假登录
        if (res.status === 503 && process.env.NODE_ENV === 'development') {
          const fallbackId = `user_${email.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
          applyAuthSuccess({
            id: fallbackId,
            name: email.split('@')[0] || '拼豆玩家',
            email,
          });
          router.push('/dashboard');
          return;
        }
        setError(typeof data.error === 'string' ? data.error : '登录失败');
        return;
      }
      applyAuthSuccess({
        id: String(data.id),
        name: String(data.name || email.split('@')[0] || '拼豆玩家'),
        email: String(data.email || email),
      });
      router.push('/dashboard');
    } catch {
      setError('网络异常，请稍后重试');
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
        <label htmlFor="login-email">
          邮箱
          <input
            id="login-email"
            name="email"
            type="email"
            autoComplete="email"
            spellCheck={false}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@example.com"
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
            placeholder="至少 8 位…"
            minLength={8}
            required
          />
        </label>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
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
