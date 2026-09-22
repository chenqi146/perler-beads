import { getDB } from './d1';
import type { Pattern, PatternData, Visibility } from '../domain/pattern';

type PatternRow = {
  id: string;
  owner_id: string;
  name: string;
  description: string;
  tags_json: string;
  visibility: string;
  data_json: string;
  created_at: number;
  updated_at: number;
};

const EMPTY_DATA: PatternData = {
  mappedPixelData: [],
  gridDimensions: { N: 0, M: 0 },
  colorCounts: null,
  totalBeadCount: 0,
  originalImageSrc: null,
  originalImageKey: null,
  selectedColorSystem: 'MARD',
};

export function rowToPattern(row: PatternRow): Pattern {
  let data: PatternData = EMPTY_DATA;
  try {
    data = JSON.parse(row.data_json) as PatternData;
  } catch {
    data = EMPTY_DATA;
  }
  let tags: string[] = [];
  try {
    tags = JSON.parse(row.tags_json) as string[];
  } catch {
    tags = [];
  }
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    description: row.description || '',
    tags: Array.isArray(tags) ? tags : [],
    visibility: (row.visibility as Visibility) || 'private',
    data,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type QueryResult<T> = {
  items: T[];
  /** false 表示 D1 未绑定 */
  available: boolean;
};

const PATTERN_COLS =
  'id, owner_id, name, description, tags_json, visibility, data_json, created_at, updated_at';

export async function listPublicPatterns(limit = 100): Promise<QueryResult<Pattern>> {
  const db = await getDB();
  if (!db) return { items: [], available: false };
  try {
    const result = await db
      .prepare(
        `SELECT ${PATTERN_COLS} FROM patterns WHERE visibility = 'public' ORDER BY updated_at DESC LIMIT ?`,
      )
      .bind(limit)
      .all<PatternRow>();
    return { items: (result.results || []).map(rowToPattern), available: true };
  } catch {
    return { items: [], available: false };
  }
}

export async function listPatternsByOwner(ownerId: string): Promise<QueryResult<Pattern>> {
  const db = await getDB();
  if (!db) return { items: [], available: false };
  try {
    const result = await db
      .prepare(`SELECT ${PATTERN_COLS} FROM patterns WHERE owner_id = ? ORDER BY updated_at DESC`)
      .bind(ownerId)
      .all<PatternRow>();
    return { items: (result.results || []).map(rowToPattern), available: true };
  } catch {
    return { items: [], available: false };
  }
}

export async function getPatternById(id: string): Promise<{ pattern: Pattern | null; available: boolean }> {
  const db = await getDB();
  if (!db) return { pattern: null, available: false };
  try {
    const row = await db
      .prepare(`SELECT ${PATTERN_COLS} FROM patterns WHERE id = ?`)
      .bind(id)
      .first<PatternRow>();
    return { pattern: row ? rowToPattern(row) : null, available: true };
  } catch {
    return { pattern: null, available: false };
  }
}
