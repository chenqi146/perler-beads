import { getDB } from './d1';
import { getSessionUserId, buildSessionCookie } from './session';
import { hashPassword } from './password';
import { isAdminEmail } from './adminConfig';
export const GUEST_EMAIL_SUFFIX = '@guest.local';

export type AuthIdentity = {
  id: string;
  name: string;
  email: string | null;
  isAnonymous: boolean;
  isAdmin?: boolean;
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
  const email = isAnonymous ? null : row.email;
  return {
    id: row.id,
    name: row.name || (isAnonymous ? '本机游客' : '拼豆玩家'),
    email,
    isAnonymous,
    isAdmin: !isAnonymous && isAdminEmail(email),
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
  } catch (err) {
    if (isMissingUsersTableError(err)) {
      throw new Error(
        'D1 缺少 users 表。请先执行 npm run db:migrate:local（或 db:migrate:dev / db:migrate:prod）',
        { cause: err },
      );
    }
    // 未跑迁移时回退：仅写旧列，靠 @guest.local 识别
    await db
      .prepare('INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?,?,?,?,?)')
      .bind(id, email, name, passwordHash, createdAt)
      .run();
  }
}

function isMissingUsersTableError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /no such table:\s*users/i.test(msg);
}

async function loadUserRow(userId: string): Promise<UserRow | null> {
  const db = await getDB();
  if (!db) return null;
  try {
    return await db
      .prepare('SELECT id, email, name, is_anonymous FROM users WHERE id = ?')
      .bind(userId)
      .first<UserRow>();
  } catch (err) {
    if (isMissingUsersTableError(err)) {
      throw new Error(
        'D1 缺少 users 表。请先执行 npm run db:migrate:local（或 db:migrate:dev / db:migrate:prod）',
        { cause: err },
      );
    }
    // 未跑 is_anonymous 迁移时回退旧列
    return await db
      .prepare('SELECT id, email, name FROM users WHERE id = ?')
      .bind(userId)
      .first<UserRow>();
  }
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

async function offlineAnonymousIdentity(
  existingId?: string | null,
): Promise<{
  identity: AuthIdentity;
  setCookie?: Awaited<ReturnType<typeof buildSessionCookie>>;
}> {
  const id = existingId || crypto.randomUUID();
  return {
    identity: {
      id,
      name: '本机游客',
      email: null,
      isAnonymous: true,
      offline: true,
    },
    setCookie: existingId ? undefined : await buildSessionCookie(id),
  };
}

/**
 * 确保当前请求有可用身份：
 * - 已有有效 session → 返回对应用户
 * - 否则创建匿名用户并签发 Cookie 配置
 * - 本地 D1/remote binding 卡住时回退离线游客，避免 /api/auth/anonymous 一直 pending
 */
export async function ensureAnonymousIdentity(): Promise<{
  identity: AuthIdentity;
  setCookie?: Awaited<ReturnType<typeof buildSessionCookie>>;
}> {
  const budgetMs = process.env.NODE_ENV === 'development' ? 2500 : 20_000;
  try {
    return await withTimeout(ensureAnonymousIdentityInner(), budgetMs, 'ensureAnonymousIdentity');
  } catch (err) {
    // 开发态 remote D1/代理卡住时常见；回退离线游客，避免接口挂死
    if (process.env.NODE_ENV === 'development') {
      console.warn(
        '[anonymous] falling back to offline guest（请确认 wrangler D1 remote=false 且已 npm run db:migrate:local，并重启 next dev）',
        err,
      );
    } else {
      console.warn('[anonymous] falling back to offline guest', err);
    }
    const existingId = await getSessionUserId().catch(() => null);
    return offlineAnonymousIdentity(existingId);
  }
}

async function probeDb(db: NonNullable<Awaited<ReturnType<typeof getDB>>>): Promise<boolean> {
  try {
    await withTimeout(
      db.prepare('SELECT 1 AS ok').bind().first<{ ok: number }>(),
      process.env.NODE_ENV === 'development' ? 800 : 5000,
      'd1.probe',
    );
    return true;
  } catch (err) {
    console.warn('[anonymous] D1 probe failed', err);
    return false;
  }
}

async function ensureAnonymousIdentityInner(): Promise<{
  identity: AuthIdentity;
  setCookie?: Awaited<ReturnType<typeof buildSessionCookie>>;
}> {
  const existingId = await getSessionUserId();
  const rawDb = await getDB();
  const db = rawDb && (await probeDb(rawDb)) ? rawDb : null;

  if (existingId) {
    if (!db) {
      return offlineAnonymousIdentity(existingId);
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
