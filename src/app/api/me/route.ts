import { NextResponse } from 'next/server';
import { getDB } from '../../../lib/d1';
import { getSessionUserId } from '../../../lib/session';

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const db = getDB();
  if (!db) {
    // 无 D1 时仍可根据 session 返回最小身份（配合本地 localStorage）
    return NextResponse.json({ id: userId, email: null, name: null, offline: true });
  }

  const user = await db
    .prepare('SELECT id, email, name FROM users WHERE id = ?')
    .bind(userId)
    .first<{ id: string; email: string; name: string }>();

  if (!user) return NextResponse.json({ error: '用户不存在' }, { status: 401 });
  return NextResponse.json({ id: user.id, email: user.email, name: user.name });
}

export async function PATCH(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const name = String(body?.name || '').trim();
  if (!name || name.length > 40) {
    return NextResponse.json({ error: '昵称需为 1–40 个字符' }, { status: 400 });
  }

  const db = getDB();
  if (!db) return NextResponse.json({ error: 'D1 未绑定' }, { status: 503 });

  await db.prepare('UPDATE users SET name = ? WHERE id = ?').bind(name, userId).run();
  const user = await db
    .prepare('SELECT id, email, name FROM users WHERE id = ?')
    .bind(userId)
    .first<{ id: string; email: string; name: string }>();

  return NextResponse.json(user);
}
