import { NextResponse } from 'next/server';
import { getDB } from '../../../../lib/d1';
import { buildSessionCookie } from '../../../../lib/session';
import { hashPassword } from '../../../../lib/password';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = String(body?.email || '')
    .trim()
    .toLowerCase();
  const name = String(body?.name || '').trim();
  const password = String(body?.password || '');

  if (!email || !password || !name || password.length < 8) {
    return NextResponse.json({ error: '邮箱、昵称和至少8位密码为必填项' }, { status: 400 });
  }

  const db = getDB();
  if (!db) return NextResponse.json({ error: 'D1 未绑定' }, { status: 503 });

  const id = crypto.randomUUID();
  try {
    await db
      .prepare('INSERT INTO users (id,email,name,password_hash,created_at) VALUES (?,?,?,?,?)')
      .bind(id, email, name, await hashPassword(password), Date.now())
      .run();
    const res = NextResponse.json({ id, name, email });
    res.cookies.set(await buildSessionCookie(id));
    return res;
  } catch {
    return NextResponse.json({ error: '邮箱已注册' }, { status: 409 });
  }
}
