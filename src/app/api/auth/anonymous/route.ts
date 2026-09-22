import { NextResponse } from 'next/server';
import { ensureAnonymousIdentity } from '@/lib/anonymous';

/** 首次访问 / 无会话时自动创建本机游客身份（Cookie 绑定浏览器） */
export async function POST() {
  try {
    const { identity, setCookie } = await ensureAnonymousIdentity();
    const res = NextResponse.json(identity);
    if (setCookie) res.cookies.set(setCookie);
    return res;
  } catch (err) {
    console.error('[auth/anonymous]', err);
    return NextResponse.json({ error: '无法创建游客身份' }, { status: 500 });
  }
}
