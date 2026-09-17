import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="platform-page flex min-h-[50vh] flex-col items-center justify-center text-center">
      <p className="eyebrow">404</p>
      <h1 className="mt-2 text-2xl font-semibold text-[#3a2416]">页面不存在</h1>
      <p className="mt-2 text-sm text-[#8a6a4a]">链接可能已失效，或页面已被移除。</p>
      <Link href="/dashboard" className="primary-button mt-6">
        回我的图纸
      </Link>
    </main>
  );
}
