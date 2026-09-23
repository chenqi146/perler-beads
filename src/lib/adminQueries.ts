import { getDB } from './d1';
import { listPatternsByOwner, type QueryResult } from './patternQueries';
import type { Pattern } from '../domain/pattern';

export type AdminUserRow = {
  id: string;
  email: string | null;
  name: string;
  isAnonymous: boolean;
  createdAt: number;
  patternCount: number;
};

type UserDbRow = {
  id: string;
  email: string;
  name: string;
  is_anonymous?: number;
  created_at: number;
  pattern_count: number;
};

export async function listUsersForAdmin(limit = 500): Promise<QueryResult<AdminUserRow>> {
  const db = await getDB();
  if (!db) return { items: [], available: false };

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
      items: (result.results || []).map((row) => ({
        id: row.id,
        email: row.is_anonymous === 1 ? null : row.email,
        name: row.name || '拼豆玩家',
        isAnonymous: row.is_anonymous === 1,
        createdAt: row.created_at,
        patternCount: Number(row.pattern_count) || 0,
      })),
      available: true,
    };
  } catch {
    // 兼容尚无 is_anonymous 列的旧库
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
        items: (result.results || []).map((row) => ({
          id: row.id,
          email: row.email,
          name: row.name || '拼豆玩家',
          isAnonymous: false,
          createdAt: row.created_at,
          patternCount: Number(row.pattern_count) || 0,
        })),
        available: true,
      };
    } catch {
      return { items: [], available: false };
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
                (SELECT COUNT(*) FROM patterns p WHERE p.owner_id = u.id) AS pattern_count
         FROM users u WHERE u.id = ?`,
      )
      .bind(userId)
      .first<UserDbRow>();

    if (!row) return { user: null, available: true };
    return {
      user: {
        id: row.id,
        email: row.is_anonymous === 1 ? null : row.email,
        name: row.name || '拼豆玩家',
        isAnonymous: row.is_anonymous === 1,
        createdAt: row.created_at,
        patternCount: Number(row.pattern_count) || 0,
      },
      available: true,
    };
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
      return {
        user: {
          id: row.id,
          email: row.email,
          name: row.name || '拼豆玩家',
          isAnonymous: false,
          createdAt: row.created_at,
          patternCount: Number(row.pattern_count) || 0,
        },
        available: true,
      };
    } catch {
      return { user: null, available: false };
    }
  }
}

export async function listPatternsForAdminOwner(ownerId: string): Promise<QueryResult<Pattern>> {
  return listPatternsByOwner(ownerId);
}
