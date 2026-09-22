'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { applyAuthSuccess } from '@/utils/authClient';
import { useToast } from '@/components/ui/ToastProvider';
import { loginAction } from '@/app/actions/auth';

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const nextPath = searchParams.get('next') || '/dashboard';

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!account.trim() || !password) return;
    setLoading(true);
    try {
      const formData = new FormData(event.currentTarget);
      formData.set('account', account.trim());
      formData.set('password', password);
      const result = await loginAction(formData);
      if (!result.ok) {
        if (result.status === 503 && process.env.NODE_ENV === 'development') {
          const fallbackId = `user_${account.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/gi, '-')}`;
          applyAuthSuccess({
            id: fallbackId,
            name: account.trim() || '拼豆玩家',
            email: account.trim(),
            isAnonymous: false,
          });
          toast('开发模式：已本地登录（无 D1）');
          router.push(nextPath.startsWith('/') ? nextPath : '/dashboard');
          return;
        }
        toast(result.error);
        return;
      }
      applyAuthSuccess({
        id: result.id,
        name: result.name || account.trim() || '拼豆玩家',
        email: result.email || account.trim(),
        isAnonymous: false,
      });
      toast('登录成功');
      router.push(nextPath.startsWith('/') ? nextPath : '/dashboard');
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
        <p className="eyebrow">WELCOME BACK</p>
        <h1>登录</h1>
        <p>绑定账号后可跨设备同步图纸；本浏览器已有游客数据会自动合并。</p>
        <input type="hidden" name="next" value={nextPath} />
        <label htmlFor="login-account">
          账号
          <input
            id="login-account"
            name="account"
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
