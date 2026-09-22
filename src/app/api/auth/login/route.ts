import { NextResponse } from 'next/server';
import { getDB } from '../../../../lib/d1';
import { buildSessionCookie, getSessionUserId } from '../../../../lib/session';
import { verifyPassword } from '../../../../lib/password';
import { mergeAnonymousIntoUser } from '../../../../lib/anonymous';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const account = String(body?.account || body?.email || '')
    .trim()
    .toLowerCase();
  const password = String(body?.password || '');
  if (!account || !password) {
    return NextResponse.json({ error: '请输入账号和密码' }, { status: 400 });
  }

  const db = await getDB();
  if (!db) return NextResponse.json({ error: 'D1 未绑定' }, { status: 503 });

  const user = await db
    .prepare('SELECT id,name,email,password_hash FROM users WHERE email=?')
    .bind(account)
    .first<{ id: string; name: string; email: string; password_hash: string }>();

  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return NextResponse.json({ error: '账号或密码错误' }, { status: 401 });
  }

  const guestId = await getSessionUserId();
  if (guestId) await mergeAnonymousIntoUser(guestId, user.id);

  const res = NextResponse.json({
    id: user.id,
    name: user.name,
    email: user.email || account,
    account: user.email || account,
    isAnonymous: false,
  });
  res.cookies.set(await buildSessionCookie(user.id));
  return res;
}
