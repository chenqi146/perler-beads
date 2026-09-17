import { Suspense } from 'react';
import type { Metadata } from 'next';
import { LoginForm } from './LoginForm';

export const metadata: Metadata = {
  title: '登录',
};

function LoginFallback() {
  return (
    <main className="platform-page auth-page">
      <div className="auth-form animate-pulse space-y-4">
        <div className="h-3 w-24 rounded bg-[#eadfce]" />
        <div className="h-8 w-32 rounded bg-[#eadfce]" />
        <div className="h-11 w-full rounded-xl bg-[#eadfce]/70" />
        <div className="h-11 w-full rounded-xl bg-[#eadfce]/70" />
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginForm />
    </Suspense>
  );
}
