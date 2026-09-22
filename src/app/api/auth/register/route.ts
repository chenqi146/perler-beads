import { NextResponse } from 'next/server';
import { getDB } from '../../../../lib/d1';
import { buildSessionCookie, getSessionUserId } from '../../../../lib/session';
import { hashPassword } from '../../../../lib/password';
import { mergeAnonymousIntoUser } from '../../../../lib/anonymous';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
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
  const passwordHash = await hashPassword(password);
  try {
    try {
      await db
        .prepare(
          'INSERT INTO users (id,email,name,password_hash,created_at,is_anonymous) VALUES (?,?,?,?,?,?)',
        )
        .bind(id, account, name, passwordHash, Date.now(), 0)
        .run();
    } catch {
      await db
        .prepare('INSERT INTO users (id,email,name,password_hash,created_at) VALUES (?,?,?,?,?)')
        .bind(id, account, name, passwordHash, Date.now())
        .run();
    }
  } catch {
    return NextResponse.json({ error: '账号已被占用' }, { status: 409 });
  }

  const guestId = await getSessionUserId();
  if (guestId) await mergeAnonymousIntoUser(guestId, id);

  const res = NextResponse.json({ id, name, email: account, account, isAnonymous: false });
  res.cookies.set(await buildSessionCookie(id));
  return res;
}
