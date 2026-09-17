import { redirect } from 'next/navigation';
import { getDB } from './d1';
import { getSessionUserId } from './session';

export type SessionUser = {
  id: string;
  email: string | null;
  name: string | null;
  offline?: boolean;
};

/** 未登录则跳转登录页（带 next） */
export async function requireSession(nextPath: string): Promise<string> {
  const userId = await getSessionUserId();
  if (!userId) {
    redirect(`/auth/login?next=${encodeURIComponent(nextPath)}`);
  }
  return userId;
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const userId = await getSessionUserId();
  if (!userId) return null;

  const db = await getDB();
  if (!db) {
    return { id: userId, email: null, name: null, offline: true };
  }

  const user = await db
    .prepare('SELECT id, email, name FROM users WHERE id = ?')
    .bind(userId)
    .first<{ id: string; email: string; name: string }>();

  if (!user) return null;
  return { id: user.id, email: user.email, name: user.name };
}
