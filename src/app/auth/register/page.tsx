'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!email || password.length < 8 || !name.trim()) return;
    localStorage.setItem('perler-user-email', email);
    localStorage.setItem('perler-user-name', name);
    localStorage.setItem('perler-user-id', `user_${email.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`);
    router.push('/dashboard');
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
        <button className="primary-button" type="submit">
          注册并进入
        </button>
        <Link href="/auth/login" className="platform-link">
          已有账号，去登录
        </Link>
      </form>
    </main>
  );
}
