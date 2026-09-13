import { NextResponse } from 'next/server';
import { getDB } from '../../../../lib/d1';
import { buildSessionCookie } from '../../../../lib/session';
import { verifyPassword } from '../../../../lib/password';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = String(body?.email || '')
    .trim()
    .toLowerCase();
  const password = String(body?.password || '');
  const db = await getDB();
  if (!db) return NextResponse.json({ error: 'D1 未绑定' }, { status: 503 });

  const user = await db
    .prepare('SELECT id,name,email,password_hash FROM users WHERE email=?')
    .bind(email)
    .first<{ id: string; name: string; email: string; password_hash: string }>();

  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return NextResponse.json({ error: '邮箱或密码错误' }, { status: 401 });
  }

  const res = NextResponse.json({ id: user.id, name: user.name, email: user.email || email });
  res.cookies.set(await buildSessionCookie(user.id));
  return res;
}
