import { redirect } from 'next/navigation';
import { getDB } from './d1';
import { getSessionUserId } from './session';
import { isGuestEmail } from './anonymous';

export type SessionUser = {
  id: string;
  email: string | null;
  name: string | null;
  isAnonymous?: boolean;
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
    return { id: userId, email: null, name: '本机游客', isAnonymous: true, offline: true };
  }

  try {
    const user = await db
      .prepare('SELECT id, email, name, is_anonymous FROM users WHERE id = ?')
      .bind(userId)
      .first<{ id: string; email: string; name: string; is_anonymous: number }>();

    if (!user) return null;
    const isAnonymous = user.is_anonymous === 1 || isGuestEmail(user.email);
    return {
      id: user.id,
      email: isAnonymous ? null : user.email,
      name: user.name || (isAnonymous ? '本机游客' : '拼豆玩家'),
      isAnonymous,
    };
  } catch {
    const user = await db
      .prepare('SELECT id, email, name FROM users WHERE id = ?')
      .bind(userId)
      .first<{ id: string; email: string; name: string }>();

    if (!user) return null;
    const isAnonymous = isGuestEmail(user.email);
    return {
      id: user.id,
      email: isAnonymous ? null : user.email,
      name: user.name || (isAnonymous ? '本机游客' : '拼豆玩家'),
      isAnonymous,
    };
  }
}
