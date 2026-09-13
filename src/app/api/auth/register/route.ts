import { NextResponse } from 'next/server';
import { getDB } from '../../../../lib/d1';
import { buildSessionCookie } from '../../../../lib/session';
import { hashPassword } from '../../../../lib/password';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  // users.email 列复用为登录账号（不限邮箱格式）
  const account = String(body?.account || body?.email || '')
    .trim()
    .toLowerCase();
  const name = String(body?.name || '').trim();
  const password = String(body?.password || '');

  if (!account || !password || !name) {
    return NextResponse.json({ error: '账号、昵称和密码为必填项' }, { status: 400 });
  }

  const db = await getDB();
  if (!db) return NextResponse.json({ error: 'D1 未绑定' }, { status: 503 });

  const id = crypto.randomUUID();
  try {
    await db
      .prepare('INSERT INTO users (id,email,name,password_hash,created_at) VALUES (?,?,?,?,?)')
      .bind(id, account, name, await hashPassword(password), Date.now())
      .run();
    const res = NextResponse.json({ id, name, email: account, account });
    res.cookies.set(await buildSessionCookie(id));
    return res;
  } catch {
    return NextResponse.json({ error: '账号已被占用' }, { status: 409 });
  }
}
