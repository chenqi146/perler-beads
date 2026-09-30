import { getDB } from './d1';
import { listPatternsByOwner, rowToPattern, type QueryResult } from './patternQueries';
import type { Pattern } from '../domain/pattern';

export type AdminUserRow = {
  id: string;
  email: string | null;
  name: string;
  isAnonymous: boolean;
  createdAt: number;
  patternCount: number;
  lastIp: string | null;
  lastSeenAt: number | null;
  lastIpGeo: string | null;
};

/** 后台图纸列表项：含格子数据，用于合成图纸预览 */
export type AdminPatternListItem = Pattern & {
  ownerName: string;
  ownerEmail: string | null;
  ownerIsAnonymous: boolean;
};

type AdminPatternListDbRow = {
  id: string;
  owner_id: string;
  name: string;
  description: string;
  tags_json: string;
  visibility: string;
  data_json: string;
  created_at: number;
  updated_at: number;
  owner_name: string | null;
  owner_email: string | null;
  owner_is_anonymous: number | null;
};

type UserDbRow = {
  id: string;
  email: string;
  name: string;
  is_anonymous?: number;
  created_at: number;
  pattern_count: number;
  last_ip?: string | null;
  last_seen_at?: number | null;
  last_ip_geo?: string | null;
};

function mapAdminUserRow(row: UserDbRow, forceRegistered = false): AdminUserRow {
  const isAnonymous = forceRegistered ? false : row.is_anonymous === 1;
  return {
    id: row.id,
    email: isAnonymous ? null : row.email,
    name: row.name || (isAnonymous ? '本机游客' : '拼豆玩家'),
    isAnonymous,
    createdAt: row.created_at,
    patternCount: Number(row.pattern_count) || 0,
    lastIp: row.last_ip || null,
    lastSeenAt: row.last_seen_at ?? null,
    lastIpGeo: row.last_ip_geo || null,
  };
}

export async function listUsersForAdmin(limit = 500): Promise<QueryResult<AdminUserRow>> {
  const db = await getDB();
  if (!db) return { items: [], available: false };

  try {
    const result = await db
      .prepare(
        `SELECT u.id, u.email, u.name, u.is_anonymous, u.created_at,
                u.last_ip, u.last_seen_at, u.last_ip_geo,
                (SELECT COUNT(*) FROM patterns p WHERE p.owner_id = u.id) AS pattern_count
         FROM users u
         ORDER BY u.is_anonymous ASC, COALESCE(u.last_seen_at, u.created_at) DESC
         LIMIT ?`,
      )
      .bind(limit)
      .all<UserDbRow>();

    return {
      items: (result.results || []).map((row) => mapAdminUserRow(row)),
      available: true,
    };
  } catch {
    // 兼容尚无 last_* / is_anonymous 列的旧库
    try {
      const result = await db
        .prepare(
          `SELECT u.id, u.email, u.name, u.is_anonymous, u.created_at,
                  (SELECT COUNT(*) FROM patterns p WHERE p.owner_id = u.id) AS pattern_count
           FROM users u
           ORDER BY u.is_anonymous ASC, u.created_at DESC
           LIMIT ?`,
        )
        .bind(limit)
        .all<UserDbRow>();

      return {
        items: (result.results || []).map((row) => mapAdminUserRow(row)),
        available: true,
      };
    } catch {
      try {
        const result = await db
          .prepare(
            `SELECT u.id, u.email, u.name, u.created_at,
                    (SELECT COUNT(*) FROM patterns p WHERE p.owner_id = u.id) AS pattern_count
             FROM users u
             ORDER BY u.created_at DESC
             LIMIT ?`,
          )
          .bind(limit)
          .all<UserDbRow>();

        return {
          items: (result.results || []).map((row) => mapAdminUserRow(row, true)),
          available: true,
        };
      } catch {
        return { items: [], available: false };
      }
    }
  }
}

export async function getUserForAdmin(
  userId: string,
): Promise<{ user: AdminUserRow | null; available: boolean }> {
  const db = await getDB();
  if (!db) return { user: null, available: false };

  try {
    const row = await db
      .prepare(
        `SELECT u.id, u.email, u.name, u.is_anonymous, u.created_at,
                u.last_ip, u.last_seen_at, u.last_ip_geo,
                (SELECT COUNT(*) FROM patterns p WHERE p.owner_id = u.id) AS pattern_count
         FROM users u WHERE u.id = ?`,
      )
      .bind(userId)
      .first<UserDbRow>();

    if (!row) return { user: null, available: true };
    return { user: mapAdminUserRow(row), available: true };
  } catch {
    try {
      const row = await db
        .prepare(
          `SELECT u.id, u.email, u.name, u.is_anonymous, u.created_at,
                  (SELECT COUNT(*) FROM patterns p WHERE p.owner_id = u.id) AS pattern_count
           FROM users u WHERE u.id = ?`,
        )
        .bind(userId)
        .first<UserDbRow>();

      if (!row) return { user: null, available: true };
      return { user: mapAdminUserRow(row), available: true };
    } catch {
      try {
        const row = await db
          .prepare(
            `SELECT u.id, u.email, u.name, u.created_at,
                    (SELECT COUNT(*) FROM patterns p WHERE p.owner_id = u.id) AS pattern_count
             FROM users u WHERE u.id = ?`,
          )
          .bind(userId)
          .first<UserDbRow>();

        if (!row) return { user: null, available: true };
        return { user: mapAdminUserRow(row, true), available: true };
      } catch {
        return { user: null, available: false };
      }
    }
  }
}

export async function listPatternsForAdminOwner(ownerId: string): Promise<QueryResult<Pattern>> {
  return listPatternsByOwner(ownerId);
}

function mapAdminPatternListItem(row: AdminPatternListDbRow): AdminPatternListItem {
  const pattern = rowToPattern(row);
  const isAnonymous = row.owner_is_anonymous === 1;
  return {
    ...pattern,
    ownerName: row.owner_name || '拼豆玩家',
    ownerEmail: isAnonymous ? null : row.owner_email,
    ownerIsAnonymous: isAnonymous,
  };
}

export async function listAllPatternsForAdmin(
  limit = 200,
): Promise<QueryResult<AdminPatternListItem>> {
  const db = await getDB();
  if (!db) return { items: [], available: false };

  const withAnon = `SELECT p.id, p.owner_id, p.name, p.description, p.tags_json, p.visibility,
            p.data_json, p.created_at, p.updated_at,
            u.name AS owner_name, u.email AS owner_email, u.is_anonymous AS owner_is_anonymous
     FROM patterns p
     LEFT JOIN users u ON u.id = p.owner_id
     ORDER BY p.updated_at DESC
     LIMIT ?`;

  const withoutAnon = `SELECT p.id, p.owner_id, p.name, p.description, p.tags_json, p.visibility,
            p.data_json, p.created_at, p.updated_at,
            u.name AS owner_name, u.email AS owner_email, 0 AS owner_is_anonymous
     FROM patterns p
     LEFT JOIN users u ON u.id = p.owner_id
     ORDER BY p.updated_at DESC
     LIMIT ?`;

  try {
    const result = await db.prepare(withAnon).bind(limit).all<AdminPatternListDbRow>();
    return {
      items: (result.results || []).map(mapAdminPatternListItem),
      available: true,
    };
  } catch {
    try {
      const result = await db.prepare(withoutAnon).bind(limit).all<AdminPatternListDbRow>();
      return {
        items: (result.results || []).map(mapAdminPatternListItem),
        available: true,
      };
    } catch {
      return { items: [], available: false };
    }
  }
}
