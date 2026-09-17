import { NextResponse } from 'next/server';
import { getDB } from '../../../lib/d1';
import { getSessionUserId } from '../../../lib/session';
import type { Visibility } from '../../../domain/pattern';
import type { Work } from '../../../types/platform';
import { imageUrlFromKey, listPublicWorks, listWorksByOwner } from '../../../lib/workQueries';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const visibility = searchParams.get('visibility');

  if (visibility === 'public') {
    const { items, available } = await listPublicWorks();
    if (!available) {
      return NextResponse.json({ works: [], message: 'D1 未绑定' }, { status: 503 });
    }
    return NextResponse.json({ works: items });
  }

  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const { items, available } = await listWorksByOwner(userId);
  if (!available) {
    return NextResponse.json({ works: [], message: 'D1 未绑定' }, { status: 503 });
  }
  return NextResponse.json({ works: items });
}

export async function POST(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const db = await getDB();
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
