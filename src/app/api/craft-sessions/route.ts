import { NextResponse } from 'next/server';
import { getDB } from '../../../lib/d1';
import { getSessionUserId } from '../../../lib/session';
import type { CraftStatus, PatternData } from '../../../domain/pattern';
import type { CraftSession } from '../../../types/platform';

type SessionRow = {
  id: string;
  pattern_id: string;
  owner_id: string;
  snapshot_json: string;
  completed_cells_json: string;
  elapsed_seconds: number;
  status: string;
  created_at: number;
  updated_at: number;
};

function rowToSession(row: SessionRow): CraftSession {
  let snapshot: PatternData;
  try {
    snapshot = JSON.parse(row.snapshot_json) as PatternData;
  } catch {
    snapshot = {
      mappedPixelData: [],
      gridDimensions: { N: 0, M: 0 },
      colorCounts: null,
      totalBeadCount: 0,
      originalImageSrc: null,
      selectedColorSystem: 'MARD',
    };
  }
  let completedCells: string[] = [];
  try {
    completedCells = JSON.parse(row.completed_cells_json) as string[];
  } catch {
    completedCells = [];
  }
  return {
    id: row.id,
    patternId: row.pattern_id,
    ownerId: row.owner_id,
    patternSnapshot: snapshot,
    completedCells: Array.isArray(completedCells) ? completedCells : [],
    elapsedSeconds: row.elapsed_seconds || 0,
    status: (row.status as CraftStatus) || 'active',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function GET(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const db = await getDB();
  if (!db) return NextResponse.json({ sessions: [], message: 'D1 未绑定' }, { status: 503 });

  const patternId = new URL(request.url).searchParams.get('patternId');
  let result;
  if (patternId) {
    result = await db
      .prepare(
        `SELECT id, pattern_id, owner_id, snapshot_json, completed_cells_json, elapsed_seconds, status, created_at, updated_at
         FROM craft_sessions WHERE owner_id = ? AND pattern_id = ? ORDER BY updated_at DESC`,
      )
      .bind(userId, patternId)
      .all<SessionRow>();
  } else {
    result = await db
      .prepare(
        `SELECT id, pattern_id, owner_id, snapshot_json, completed_cells_json, elapsed_seconds, status, created_at, updated_at
         FROM craft_sessions WHERE owner_id = ? ORDER BY updated_at DESC`,
      )
      .bind(userId)
      .all<SessionRow>();
  }

  return NextResponse.json({ sessions: (result.results || []).map(rowToSession) });
}

export async function POST(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const db = await getDB();
  if (!db) return NextResponse.json({ error: 'D1 未绑定' }, { status: 503 });

  const body = await request.json().catch(() => null);
  if (!body?.patternId) {
    return NextResponse.json({ error: 'patternId is required' }, { status: 400 });
  }

  const now = Date.now();
  const id = String(body.id || crypto.randomUUID());
  const status: CraftStatus =
    body.status === 'completed' || body.status === 'paused' ? body.status : 'active';
  const completedCells = Array.isArray(body.completedCells) ? body.completedCells.map(String) : [];
  const elapsedSeconds = Number(body.elapsedSeconds) || 0;
  const snapshot = body.patternSnapshot ?? body.snapshot ?? {
    mappedPixelData: [],
    gridDimensions: { N: 0, M: 0 },
    colorCounts: null,
    totalBeadCount: 0,
    originalImageSrc: null,
    selectedColorSystem: 'MARD',
  };

  const existing = await db
    .prepare('SELECT id, owner_id, created_at FROM craft_sessions WHERE id = ?')
    .bind(id)
    .first<{ id: string; owner_id: string; created_at: number }>();

  if (existing && existing.owner_id !== userId) {
    return NextResponse.json({ error: '无权覆盖该会话' }, { status: 403 });
  }

  const createdAt = existing?.created_at ?? now;

  await db
    .prepare(
      `INSERT INTO craft_sessions (id, pattern_id, owner_id, snapshot_json, completed_cells_json, elapsed_seconds, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         snapshot_json = excluded.snapshot_json,
         completed_cells_json = excluded.completed_cells_json,
         elapsed_seconds = excluded.elapsed_seconds,
         status = excluded.status,
         updated_at = excluded.updated_at
       WHERE craft_sessions.owner_id = excluded.owner_id`,
    )
    .bind(
      id,
      String(body.patternId),
      userId,
      JSON.stringify(snapshot),
      JSON.stringify(completedCells),
      elapsedSeconds,
      status,
      createdAt,
      now,
    )
    .run();

  const session: CraftSession = {
    id,
    patternId: String(body.patternId),
    ownerId: userId,
    patternSnapshot: snapshot,
    completedCells,
    elapsedSeconds,
    status,
    createdAt,
    updatedAt: now,
  };
  return NextResponse.json({ session });
}
