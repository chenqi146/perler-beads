import { getDB } from './d1';
import { getClientIp } from './clientIp';
import { resolveIpGeo } from './ipGeo';

const MIN_TOUCH_INTERVAL_MS = 60_000;
const GUEST_EMAIL_SUFFIX = '@guest.local';

function isGuestRow(email: string | null | undefined, isAnonymous: number | null | undefined) {
  return isAnonymous === 1 || Boolean(email && email.endsWith(GUEST_EMAIL_SUFFIX));
}

/**
 * 更新游客最近访问 IP / 时间 / 归属地。
 * 仅匿名用户；同 IP 且 1 分钟内重复访问会跳过写库。
 */
export async function touchGuestPresence(userId: string, headers: Headers): Promise<void> {
  if (!userId) return;
  const db = await getDB();
  if (!db) return;

  const ip = getClientIp(headers);
  const now = Date.now();

  try {
    const row = await db
      .prepare(
        `SELECT email, is_anonymous, last_ip, last_seen_at, last_ip_geo
         FROM users WHERE id = ?`,
      )
      .bind(userId)
      .first<{
        email: string;
        is_anonymous: number;
        last_ip: string | null;
        last_seen_at: number | null;
        last_ip_geo: string | null;
      }>();

    if (!row) return;
    if (!isGuestRow(row.email, row.is_anonymous)) return;

    const sameIp = Boolean(ip && row.last_ip && ip === row.last_ip);
    const recent =
      typeof row.last_seen_at === 'number' && now - row.last_seen_at < MIN_TOUCH_INTERVAL_MS;
    if (sameIp && recent) return;

    let geo = row.last_ip_geo;
    if (ip && (!sameIp || !geo)) {
      geo = (await resolveIpGeo(ip, headers)) || geo || null;
    }

    await db
      .prepare(
        `UPDATE users
         SET last_ip = ?, last_seen_at = ?, last_ip_geo = ?
         WHERE id = ?`,
      )
      .bind(ip || row.last_ip || null, now, geo || null, userId)
      .run();
  } catch (err) {
    // 未跑 0005 迁移时静默跳过，避免拖垮游客登录
    const msg = err instanceof Error ? err.message : String(err);
    if (/no such column:\s*last_/i.test(msg)) return;
    console.warn('[touchGuestPresence]', err);
  }
}
