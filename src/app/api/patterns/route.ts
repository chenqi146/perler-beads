import { NextResponse } from 'next/server';
import { getDB } from '../../../lib/d1';
import { getSessionUserId } from '../../../lib/session';
import type { Pattern, PatternData, Visibility } from '../../../domain/pattern';

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

function rowToPattern(row: PatternRow): Pattern {
  let data: PatternData;
  try {
    data = JSON.parse(row.data_json) as PatternData;
  } catch {
    data = {
      mappedPixelData: [],
      gridDimensions: { N: 0, M: 0 },
      colorCounts: null,
      totalBeadCount: 0,
      originalImageSrc: null,
      selectedColorSystem: 'MARD',
    };
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

export async function GET(request: Request) {
  const db = getDB();
  if (!db) {
    return NextResponse.json({ patterns: [], message: 'D1 未绑定' }, { status: 503 });
  }

  const visibility = new URL(request.url).searchParams.get('visibility');
  if (visibility === 'public') {
    const result = await db
      .prepare(
        `SELECT id, owner_id, name, description, tags_json, visibility, data_json, created_at, updated_at
         FROM patterns WHERE visibility = 'public' ORDER BY updated_at DESC LIMIT 100`,
      )
      .bind()
      .all<PatternRow>();
    return NextResponse.json({ patterns: (result.results || []).map(rowToPattern) });
  }

  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const result = await db
    .prepare(
      'SELECT id, owner_id, name, description, tags_json, visibility, data_json, created_at, updated_at FROM patterns WHERE owner_id = ? ORDER BY updated_at DESC',
    )
    .bind(userId)
    .all<PatternRow>();

  const patterns = (result.results || []).map(rowToPattern);
  return NextResponse.json({ patterns });
}

export async function POST(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }
  const db = getDB();
  if (!db) {
    return NextResponse.json({ error: 'D1 未绑定' }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: '无效请求体' }, { status: 400 });
  }

  const id = String(body.id || crypto.randomUUID());
  const name = String(body.name || '未命名图纸').slice(0, 200);
  const description = String(body.description || '');
  const tags = Array.isArray(body.tags) ? body.tags.map(String) : [];
  const visibility: Visibility = body.visibility === 'public' ? 'public' : 'private';
  const data = body.data ?? {
    mappedPixelData: [],
    gridDimensions: { N: 0, M: 0 },
    colorCounts: null,
    totalBeadCount: 0,
    originalImageSrc: null,
    selectedColorSystem: 'MARD',
  };
  const now = Date.now();

  const existing = await db
    .prepare('SELECT id, owner_id, created_at FROM patterns WHERE id = ?')
    .bind(id)
    .first<{ id: string; owner_id: string; created_at: number }>();

  if (existing && existing.owner_id !== userId) {
    return NextResponse.json({ error: '无权覆盖该图纸' }, { status: 403 });
  }

  const createdAt = existing?.created_at ?? (typeof body.createdAt === 'number' ? body.createdAt : now);
  const updatedAt = typeof body.updatedAt === 'number' ? body.updatedAt : now;

  try {
    await db
      .prepare(
        `INSERT INTO patterns (id, owner_id, name, description, tags_json, visibility, data_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           description = excluded.description,
           tags_json = excluded.tags_json,
           visibility = excluded.visibility,
           data_json = excluded.data_json,
           updated_at = excluded.updated_at
         WHERE patterns.owner_id = excluded.owner_id`,
      )
      .bind(
        id,
        userId,
        name,
        description,
        JSON.stringify(tags),
        visibility,
        JSON.stringify(data),
        createdAt,
        updatedAt,
      )
      .run();
  } catch (error) {
    const message = error instanceof Error ? error.message : '保存失败';
    return NextResponse.json({ error: message }, { status: 413 });
  }

  const pattern: Pattern = {
    id,
    ownerId: userId,
    name,
    description,
    tags,
    visibility,
    data,
    createdAt,
    updatedAt,
  };
  return NextResponse.json({ pattern });
}
