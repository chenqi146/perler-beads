'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { applyAuthSuccess } from '@/utils/authClient';
import { useToast } from '@/components/ui/ToastProvider';

export default function RegisterPage() {
  const router = useRouter();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!email || password.length < 8 || !name.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password, name: name.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 503 && process.env.NODE_ENV === 'development') {
          const fallbackId = `user_${email.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
          applyAuthSuccess({ id: fallbackId, name: name.trim(), email });
          toast('开发模式：已本地注册登录（无 D1）');
          router.push('/dashboard');
          return;
        }
        toast(typeof data.error === 'string' ? data.error : '注册失败');
        return;
      }
      applyAuthSuccess({
        id: String(data.id),
        name: String(data.name || name.trim()),
        email: String(data.email || email),
      });
      toast('注册成功');
      router.push('/dashboard');
    } catch {
      toast('网络异常，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="platform-page auth-page">
      <form className="auth-form" onSubmit={submit}>
        <p className="eyebrow">CREATE ACCOUNT</p>
        <h1>注册账号</h1>
        <label htmlFor="register-name">
          昵称
          <input
            id="register-name"
            name="name"
            autoComplete="nickname"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
        </label>
        <label htmlFor="register-email">
          邮箱
          <input
            id="register-email"
            name="email"
            type="email"
            autoComplete="email"
            spellCheck={false}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>
        <label htmlFor="register-password">
          密码
          <input
            id="register-password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="至少 8 位…"
            required
          />
        </label>
        <button className="primary-button" type="submit" disabled={loading}>
          {loading ? '注册中…' : '注册并进入'}
        </button>
        <Link href="/auth/login" className="platform-link">
          已有账号，去登录
        </Link>
      </form>
    </main>
  );
}
