'use server';

import { getDB } from '@/lib/d1';
import { getSessionUserId } from '@/lib/session';
import type { SessionUser } from '@/lib/auth';

export type ProfileActionResult =
  | { ok: true; user: SessionUser }
  | { ok: false; error: string };

export async function updateProfileAction(name: string): Promise<ProfileActionResult> {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 40) {
    return { ok: false, error: '昵称需为 1–40 个字符' };
  }

  const userId = await getSessionUserId();
  if (!userId) return { ok: false, error: '未登录' };

  const db = await getDB();
  if (!db) return { ok: false, error: 'D1 未绑定' };

  await db.prepare('UPDATE users SET name = ? WHERE id = ?').bind(trimmed, userId).run();
  const user = await db
    .prepare('SELECT id, email, name FROM users WHERE id = ?')
    .bind(userId)
    .first<{ id: string; email: string; name: string }>();

  if (!user) return { ok: false, error: '用户不存在' };
  return { ok: true, user: { id: user.id, email: user.email, name: user.name } };
}
