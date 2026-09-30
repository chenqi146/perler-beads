import { NextResponse, after } from 'next/server';
import { ensureAnonymousIdentity } from '@/lib/anonymous';
import { touchGuestPresence } from '@/lib/guestPresence';

/** 首次访问 / 无会话时自动创建本机游客身份（Cookie 绑定浏览器） */
export async function POST(request: Request) {
  try {
    const { identity, setCookie } = await ensureAnonymousIdentity();
    const res = NextResponse.json(identity);
    if (setCookie) res.cookies.set(setCookie);

    if (identity.isAnonymous && !identity.offline) {
      const headers = request.headers;
      const userId = identity.id;
      after(() => {
        void touchGuestPresence(userId, headers);
      });
    }

    return res;
  } catch (err) {
    console.error('[auth/anonymous]', err);
    return NextResponse.json({ error: '无法创建游客身份' }, { status: 500 });
  }
}
