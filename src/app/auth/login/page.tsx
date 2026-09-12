'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!email || !password) return;
    localStorage.setItem('perler-user-email', email);
    localStorage.setItem('perler-user-id', `user_${email.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`);
    router.push('/dashboard');
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
        <button className="primary-button" type="submit">
          登录
        </button>
        <Link href="/auth/register" className="platform-link">
          注册新账号
        </Link>
      </form>
    </main>
  );
}
