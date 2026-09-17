import { getDB } from './d1';
import type { Visibility } from '../domain/pattern';
import type { Work } from '../types/platform';
import type { QueryResult } from './patternQueries';

type WorkRow = {
  id: string;
  pattern_id: string;
  craft_session_id: string;
  owner_id: string;
  title: string;
  description: string;
  tags_json: string;
  image_key: string;
  visibility: string;
  created_at: number;
};

export function imageUrlFromKey(key: string): string {
  if (!key) return '';
  if (key.startsWith('data:') || key.startsWith('http') || key.startsWith('/')) return key;
  return `/api/uploads/${key.split('/').map(encodeURIComponent).join('/')}`;
}

export function rowToWork(row: WorkRow): Work {
  let tags: string[] = [];
  try {
    tags = JSON.parse(row.tags_json) as string[];
  } catch {
    tags = [];
  }
  return {
    id: row.id,
    patternId: row.pattern_id,
    craftSessionId: row.craft_session_id,
    ownerId: row.owner_id,
    title: row.title,
    description: row.description || '',
    tags: Array.isArray(tags) ? tags : [],
    imageUrl: imageUrlFromKey(row.image_key),
    visibility: (row.visibility as Visibility) || 'private',
    createdAt: row.created_at,
  };
}

const WORK_COLS =
  'id, pattern_id, craft_session_id, owner_id, title, description, tags_json, image_key, visibility, created_at';

export async function listPublicWorks(limit = 100): Promise<QueryResult<Work>> {
  const db = await getDB();
  if (!db) return { items: [], available: false };
  const result = await db
    .prepare(
      `SELECT ${WORK_COLS} FROM works WHERE visibility = 'public' ORDER BY created_at DESC LIMIT ?`,
    )
    .bind(limit)
    .all<WorkRow>();
  return { items: (result.results || []).map(rowToWork), available: true };
}

export async function listWorksByOwner(ownerId: string): Promise<QueryResult<Work>> {
  const db = await getDB();
  if (!db) return { items: [], available: false };
  const result = await db
    .prepare(`SELECT ${WORK_COLS} FROM works WHERE owner_id = ? ORDER BY created_at DESC`)
    .bind(ownerId)
    .all<WorkRow>();
  return { items: (result.results || []).map(rowToWork), available: true };
}
