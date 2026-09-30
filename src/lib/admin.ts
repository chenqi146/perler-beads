import { redirect } from 'next/navigation';
import { getDB, getRuntimeSecret } from './d1';
import { getCurrentUser, type SessionUser } from './auth';
import { hashPassword, verifyPassword } from './password';
import { getAdminEmail, isAdminEmail } from './adminConfig';

export { getAdminEmail, isAdminEmail } from './adminConfig';

export function isAdminUser(user: Pick<SessionUser, 'email' | 'isAnonymous'> | null | undefined): boolean {
  if (!user || user.isAnonymous) return false;
  return isAdminEmail(user.email);
}

/**
 * 若配置了 ADMIN_PASSWORD（process.env 或 Cloudflare/.dev.vars 绑定）：
 * - 管理员不存在则自动创建
 * - 已存在但密码与配置不一致则同步更新（环境变量为 admin 密码源）
 */
export async function ensureAdminUser(): Promise<void> {
  const email = (
    (await getRuntimeSecret('ADMIN_EMAIL')) ||
    getAdminEmail()
  )
    .trim()
    .toLowerCase();
  const password = await getRuntimeSecret('ADMIN_PASSWORD');
  if (!email || !password) return;

  const db = await getDB();
  if (!db) return;

  try {
    const existing = await db
      .prepare('SELECT id, password_hash FROM users WHERE email = ?')
      .bind(email)
      .first<{ id: string; password_hash: string }>();

    if (existing) {
      if (!(await verifyPassword(password, existing.password_hash))) {
        const passwordHash = await hashPassword(password);
        await db
          .prepare('UPDATE users SET password_hash = ? WHERE id = ?')
          .bind(passwordHash, existing.id)
          .run();
      }
      return;
    }

    const id = crypto.randomUUID();
    const passwordHash = await hashPassword(password);
    try {
      await db
        .prepare(
          'INSERT INTO users (id,email,name,password_hash,created_at,is_anonymous) VALUES (?,?,?,?,?,?)',
        )
        .bind(id, email, '管理员', passwordHash, Date.now(), 0)
        .run();
    } catch {
      await db
        .prepare('INSERT INTO users (id,email,name,password_hash,created_at) VALUES (?,?,?,?,?)')
        .bind(id, email, '管理员', passwordHash, Date.now())
        .run();
    }
  } catch (err) {
    console.warn('[admin] ensureAdminUser failed', err);
  }
}

/** 当前会话必须是管理员，否则 403 JSON（API 用） */
export async function requireAdminApi(): Promise<SessionUser | Response> {
  await ensureAdminUser();
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: '未登录' }, { status: 401 });
  }
  if (!isAdminUser(user)) {
    return Response.json({ error: '需要管理员权限' }, { status: 403 });
  }
  return user;
}

/** 页面用：非管理员跳转首页 */
export async function requireAdminPage(): Promise<SessionUser> {
  await ensureAdminUser();
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/auth/login?next=${encodeURIComponent('/admin')}`);
  }
  if (!isAdminUser(user)) {
    redirect('/dashboard');
  }
  return user;
}
