import { NextResponse } from 'next/server';
import { getDB } from '../../../lib/d1';
import { getSessionUserId } from '../../../lib/session';
import type { Visibility } from '../../../domain/pattern';
import type { Work } from '../../../types/platform';

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

function imageUrlFromKey(key: string): string {
  if (!key) return '';
  if (key.startsWith('data:') || key.startsWith('http') || key.startsWith('/')) return key;
  return `/api/uploads/${key.split('/').map(encodeURIComponent).join('/')}`;
}

function rowToWork(row: WorkRow): Work {
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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const visibility = searchParams.get('visibility');
  const db = getDB();
  if (!db) {
    return NextResponse.json({ works: [], message: 'D1 未绑定' }, { status: 503 });
  }

  if (visibility === 'public') {
    const result = await db
      .prepare(
        `SELECT id, pattern_id, craft_session_id, owner_id, title, description, tags_json, image_key, visibility, created_at
         FROM works WHERE visibility = 'public' ORDER BY created_at DESC LIMIT 100`,
      )
      .bind()
      .all<WorkRow>();
    return NextResponse.json({ works: (result.results || []).map(rowToWork) });
  }

  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const result = await db
    .prepare(
      `SELECT id, pattern_id, craft_session_id, owner_id, title, description, tags_json, image_key, visibility, created_at
       FROM works WHERE owner_id = ? ORDER BY created_at DESC`,
    )
    .bind(userId)
    .all<WorkRow>();

  return NextResponse.json({ works: (result.results || []).map(rowToWork) });
}

export async function POST(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const db = getDB();
  if (!db) return NextResponse.json({ error: 'D1 未绑定' }, { status: 503 });

  const body = await request.json().catch(() => null);
  if (!body?.title || !body?.craftSessionId) {
    return NextResponse.json({ error: 'title and craftSessionId are required' }, { status: 400 });
  }

  const imageKey = String(body.imageKey || body.image_key || body.imageUrl || '');
  if (!imageKey) {
    return NextResponse.json({ error: '缺少 imageKey' }, { status: 400 });
  }

  const id = String(body.id || crypto.randomUUID());
  const now = Date.now();
  const tags = Array.isArray(body.tags) ? body.tags.map(String) : [];
  const visibility: Visibility = body.visibility === 'public' ? 'public' : 'private';

  await db
    .prepare(
      `INSERT INTO works (id, pattern_id, craft_session_id, owner_id, title, description, tags_json, image_key, visibility, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      String(body.patternId || ''),
      String(body.craftSessionId),
      userId,
      String(body.title).slice(0, 200),
      String(body.description || ''),
      JSON.stringify(tags),
      imageKey,
      visibility,
      now,
    )
    .run();

  const work: Work = {
    id,
    patternId: String(body.patternId || ''),
    craftSessionId: String(body.craftSessionId),
    ownerId: userId,
    title: String(body.title).slice(0, 200),
    description: String(body.description || ''),
    tags,
    imageUrl: imageUrlFromKey(imageKey),
    visibility,
    createdAt: now,
  };
  return NextResponse.json({ work });
}
