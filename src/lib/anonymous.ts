import { getDB } from './d1';
import { getSessionUserId, buildSessionCookie } from './session';
import { hashPassword } from './password';

export const GUEST_EMAIL_SUFFIX = '@guest.local';

export type AuthIdentity = {
  id: string;
  name: string;
  email: string | null;
  isAnonymous: boolean;
  offline?: boolean;
};

export function isGuestEmail(email: string | null | undefined): boolean {
  return Boolean(email && email.endsWith(GUEST_EMAIL_SUFFIX));
}

export function guestEmailFor(userId: string): string {
  return `anon_${userId.replace(/-/g, '')}${GUEST_EMAIL_SUFFIX}`;
}

type UserRow = {
  id: string;
  email: string | null;
  name: string | null;
  is_anonymous?: number | null;
};

function toIdentity(row: UserRow, offline = false): AuthIdentity {
  const isAnonymous = row.is_anonymous === 1 || isGuestEmail(row.email);
  return {
    id: row.id,
    name: row.name || (isAnonymous ? '本机游客' : '拼豆玩家'),
    email: isAnonymous ? null : row.email,
    isAnonymous,
    offline: offline || undefined,
  };
}

/** 判断库中用户是否为匿名游客（兼容尚未跑 is_anonymous 迁移的库） */
export async function isAnonymousUserId(userId: string): Promise<boolean> {
  const db = await getDB();
  if (!db) return userId.length > 0;
  try {
    const row = await db
      .prepare('SELECT id, email, is_anonymous FROM users WHERE id = ?')
      .bind(userId)
      .first<{ id: string; email: string; is_anonymous: number }>();
    if (!row) return false;
    return row.is_anonymous === 1 || isGuestEmail(row.email);
  } catch {
    const row = await db
      .prepare('SELECT id, email FROM users WHERE id = ?')
      .bind(userId)
      .first<{ id: string; email: string }>();
    return Boolean(row && isGuestEmail(row.email));
  }
}

/** 把匿名用户的云端数据迁到正式账号，并删除游客行 */
export async function mergeAnonymousIntoUser(guestId: string, targetUserId: string): Promise<void> {
  if (!guestId || !targetUserId || guestId === targetUserId) return;
  const db = await getDB();
  if (!db) return;
  if (!(await isAnonymousUserId(guestId))) return;

  await db.prepare('UPDATE patterns SET owner_id = ? WHERE owner_id = ?').bind(targetUserId, guestId).run();
  await db
    .prepare('UPDATE craft_sessions SET owner_id = ? WHERE owner_id = ?')
    .bind(targetUserId, guestId)
    .run();
  await db.prepare('UPDATE works SET owner_id = ? WHERE owner_id = ?').bind(targetUserId, guestId).run();
  await db.prepare('DELETE FROM users WHERE id = ?').bind(guestId).run();
}

async function insertAnonymousUser(id: string, name: string): Promise<void> {
  const db = await getDB();
  if (!db) throw new Error('D1 未绑定');
  const email = guestEmailFor(id);
  const passwordHash = await hashPassword(crypto.randomUUID());
  const createdAt = Date.now();

  try {
    await db
      .prepare(
        'INSERT INTO users (id, email, name, password_hash, created_at, is_anonymous) VALUES (?,?,?,?,?,?)',
      )
      .bind(id, email, name, passwordHash, createdAt, 1)
      .run();
  } catch {
    // 未跑迁移时回退：仅写旧列，靠 @guest.local 识别
    await db
      .prepare('INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?,?,?,?,?)')
      .bind(id, email, name, passwordHash, createdAt)
      .run();
  }
}

async function loadUserRow(userId: string): Promise<UserRow | null> {
  const db = await getDB();
  if (!db) return null;
  try {
    return await db
      .prepare('SELECT id, email, name, is_anonymous FROM users WHERE id = ?')
      .bind(userId)
      .first<UserRow>();
  } catch {
    return await db
      .prepare('SELECT id, email, name FROM users WHERE id = ?')
      .bind(userId)
      .first<UserRow>();
  }
}

/**
 * 确保当前请求有可用身份：
 * - 已有有效 session → 返回对应用户
 * - 否则创建匿名用户并签发 Cookie 配置
 */
export async function ensureAnonymousIdentity(): Promise<{
  identity: AuthIdentity;
  setCookie?: Awaited<ReturnType<typeof buildSessionCookie>>;
}> {
  const existingId = await getSessionUserId();
  const db = await getDB();

  if (existingId) {
    if (!db) {
      return {
        identity: {
          id: existingId,
          name: '本机游客',
          email: null,
          isAnonymous: true,
          offline: true,
        },
      };
    }
    const row = await loadUserRow(existingId);
    if (row) {
      return { identity: toIdentity(row) };
    }
    // Cookie 指向已删用户 → 重新发匿名号
  }

  const id = crypto.randomUUID();
  const name = '本机游客';

  if (!db) {
    return {
      identity: { id, name, email: null, isAnonymous: true, offline: true },
      setCookie: await buildSessionCookie(id),
    };
  }

  await insertAnonymousUser(id, name);
  return {
    identity: { id, name, email: null, isAnonymous: true },
    setCookie: await buildSessionCookie(id),
  };
}
