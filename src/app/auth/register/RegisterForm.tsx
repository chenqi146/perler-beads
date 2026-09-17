'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { applyAuthSuccess } from '@/utils/authClient';
import { useToast } from '@/components/ui/ToastProvider';
import { registerAction } from '@/app/actions/auth';

export default function RegisterForm() {
  const router = useRouter();
  const toast = useToast();
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!account.trim() || !password || !name.trim()) return;
    setLoading(true);
    try {
      const formData = new FormData(event.currentTarget);
      formData.set('account', account.trim());
      formData.set('password', password);
      formData.set('name', name.trim());
      const result = await registerAction(formData);
      if (!result.ok) {
        if (result.status === 503 && process.env.NODE_ENV === 'development') {
          const fallbackId = `user_${account.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/gi, '-')}`;
          applyAuthSuccess({ id: fallbackId, name: name.trim(), email: account.trim() });
          toast('开发模式：已本地注册登录（无 D1）');
          router.push('/dashboard');
          return;
        }
        toast(result.error);
        return;
      }
      applyAuthSuccess({
        id: result.id,
        name: result.name || name.trim(),
        email: result.email || account.trim(),
      });
      toast('注册成功');
      router.push('/dashboard');
      router.refresh();
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
        <label htmlFor="register-account">
          账号
          <input
            id="register-account"
            name="account"
            type="text"
            autoComplete="username"
            spellCheck={false}
            value={account}
            onChange={(event) => setAccount(event.target.value)}
            placeholder="任意字符均可"
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
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="自行设定"
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
