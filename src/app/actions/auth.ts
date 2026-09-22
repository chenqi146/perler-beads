'use server';

import { cookies } from 'next/headers';
import { getDB } from '@/lib/d1';
import { buildSessionCookie, getSessionUserId } from '@/lib/session';
import { hashPassword, verifyPassword } from '@/lib/password';
import { mergeAnonymousIntoUser } from '@/lib/anonymous';

export type AuthActionResult =
  | { ok: true; id: string; name: string; email: string; isAnonymous?: boolean }
  | { ok: false; error: string; status?: number };

function normalizeAccount(raw: FormDataEntryValue | null): string {
  return String(raw || '')
    .trim()
    .toLowerCase();
}

async function adoptGuestSession(targetUserId: string): Promise<void> {
  const guestId = await getSessionUserId();
  if (guestId) await mergeAnonymousIntoUser(guestId, targetUserId);
}

export async function loginAction(formData: FormData): Promise<AuthActionResult> {
  const account = normalizeAccount(formData.get('account') ?? formData.get('username'));
  const password = String(formData.get('password') || '');

  if (!account || !password) {
    return { ok: false, error: '请输入账号和密码' };
  }

  const db = await getDB();
  if (!db) {
    return { ok: false, error: 'D1 未绑定', status: 503 };
  }

  const user = await db
    .prepare('SELECT id,name,email,password_hash FROM users WHERE email=?')
    .bind(account)
    .first<{ id: string; name: string; email: string; password_hash: string }>();

  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return { ok: false, error: '账号或密码错误', status: 401 };
  }

  await adoptGuestSession(user.id);

  const jar = await cookies();
  jar.set(await buildSessionCookie(user.id));

  return {
    ok: true,
    id: user.id,
    name: user.name,
    email: user.email || account,
    isAnonymous: false,
  };
}

export async function registerAction(formData: FormData): Promise<AuthActionResult> {
  const account = normalizeAccount(formData.get('account') ?? formData.get('username'));
  const name = String(formData.get('name') || '').trim();
  const password = String(formData.get('password') || '');

  if (!account || !password || !name) {
    return { ok: false, error: '账号、昵称和密码为必填项' };
  }

  const db = await getDB();
  if (!db) {
    return { ok: false, error: 'D1 未绑定', status: 503 };
  }

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
    return { ok: false, error: '账号已被占用', status: 409 };
  }

  await adoptGuestSession(id);

  const jar = await cookies();
  jar.set(await buildSessionCookie(id));

  return { ok: true, id, name, email: account, isAnonymous: false };
}
