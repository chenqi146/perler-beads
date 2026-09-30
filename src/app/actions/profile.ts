'use server';

import { getDB } from '@/lib/d1';
import { getSessionUserId } from '@/lib/session';
import { isGuestEmail } from '@/lib/anonymous';
import { hashPassword, verifyPassword } from '@/lib/password';
import { isAdminEmail } from '@/lib/adminConfig';
import type { SessionUser } from '@/lib/auth';

const MIN_PASSWORD_LENGTH = 6;

export type ProfileActionResult =
  | { ok: true; user: SessionUser }
  | { ok: false; error: string };

export type ChangePasswordResult =
  | { ok: true; message?: string }
  | { ok: false; error: string };

export async function updateProfileAction(name: string): Promise<ProfileActionResult> {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 40) {
    return { ok: false, error: '昵称需为 1–40 个字符' };
  }

  const userId = await getSessionUserId();
  if (!userId) return { ok: false, error: '身份未就绪，请刷新页面' };

  const db = await getDB();
  if (!db) return { ok: false, error: 'D1 未绑定' };

  await db.prepare('UPDATE users SET name = ? WHERE id = ?').bind(trimmed, userId).run();

  try {
    const user = await db
      .prepare('SELECT id, email, name, is_anonymous FROM users WHERE id = ?')
      .bind(userId)
      .first<{ id: string; email: string; name: string; is_anonymous: number }>();
    if (!user) return { ok: false, error: '用户不存在' };
    const isAnonymous = user.is_anonymous === 1 || isGuestEmail(user.email);
    return {
      ok: true,
      user: {
        id: user.id,
        email: isAnonymous ? null : user.email,
        name: user.name,
        isAnonymous,
        isAdmin: !isAnonymous && isAdminEmail(user.email),
      },
    };
  } catch {
    const user = await db
      .prepare('SELECT id, email, name FROM users WHERE id = ?')
      .bind(userId)
      .first<{ id: string; email: string; name: string }>();
    if (!user) return { ok: false, error: '用户不存在' };
    const isAnonymous = isGuestEmail(user.email);
    return {
      ok: true,
      user: {
        id: user.id,
        email: isAnonymous ? null : user.email,
        name: user.name,
        isAnonymous,
        isAdmin: !isAnonymous && isAdminEmail(user.email),
      },
    };
  }
}

/** 正式账号修改密码（游客不可用） */
export async function changePasswordAction(input: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}): Promise<ChangePasswordResult> {
  const currentPassword = String(input.currentPassword || '');
  const newPassword = String(input.newPassword || '');
  const confirmPassword = String(input.confirmPassword || '');

  if (!currentPassword || !newPassword || !confirmPassword) {
    return { ok: false, error: '请填写当前密码和新密码' };
  }
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, error: `新密码至少 ${MIN_PASSWORD_LENGTH} 位` };
  }
  if (newPassword !== confirmPassword) {
    return { ok: false, error: '两次输入的新密码不一致' };
  }
  if (newPassword === currentPassword) {
    return { ok: false, error: '新密码不能与当前密码相同' };
  }

  const userId = await getSessionUserId();
  if (!userId) return { ok: false, error: '身份未就绪，请刷新页面' };

  const db = await getDB();
  if (!db) return { ok: false, error: 'D1 未绑定' };

  let row: { id: string; email: string; password_hash: string; is_anonymous?: number } | null =
    null;
  try {
    row = await db
      .prepare('SELECT id, email, password_hash, is_anonymous FROM users WHERE id = ?')
      .bind(userId)
      .first<{ id: string; email: string; password_hash: string; is_anonymous: number }>();
  } catch {
    row = await db
      .prepare('SELECT id, email, password_hash FROM users WHERE id = ?')
      .bind(userId)
      .first<{ id: string; email: string; password_hash: string }>();
  }

  if (!row) return { ok: false, error: '用户不存在' };

  const isAnonymous =
    (typeof row.is_anonymous === 'number' && row.is_anonymous === 1) || isGuestEmail(row.email);
  if (isAnonymous) {
    return { ok: false, error: '游客请先绑定账号后再修改密码' };
  }

  if (!(await verifyPassword(currentPassword, row.password_hash))) {
    return { ok: false, error: '当前密码不正确' };
  }

  // 管理员密码以 ADMIN_PASSWORD（.dev.vars / Cloudflare secret）为准，避免改完又被同步覆盖
  if (isAdminEmail(row.email)) {
    return {
      ok: false,
      error: '管理员请在 .dev.vars 或 Cloudflare Secret 中修改 ADMIN_PASSWORD（含 # 时需加双引号）',
    };
  }

  const passwordHash = await hashPassword(newPassword);
  await db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(passwordHash, userId).run();

  return { ok: true };
}
