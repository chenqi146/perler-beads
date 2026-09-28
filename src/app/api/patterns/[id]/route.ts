import { NextResponse } from 'next/server';
import { getCurrentUser } from '../../../../lib/auth';
import { isAdminUser } from '../../../../lib/admin';
import { getPatternById } from '../../../../lib/patternQueries';
import { getSessionUserId } from '../../../../lib/session';
import { getDB, getR2 } from '../../../../lib/d1';

type Params = { params: Promise<{ id: string }> };

/** 拉取单张图纸：本人 / 公开 / 管理员 可见 */
export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: '缺少图纸 id' }, { status: 400 });
  }

  const { pattern, available } = await getPatternById(id);
  if (!available) {
    return NextResponse.json({ error: 'D1 未绑定' }, { status: 503 });
  }
  if (!pattern) {
    return NextResponse.json({ error: '图纸不存在' }, { status: 404 });
  }

  if (pattern.visibility === 'public') {
    return NextResponse.json({ pattern });
  }

  const userId = await getSessionUserId();
  const user = await getCurrentUser();
  if (userId && pattern.ownerId === userId) {
    return NextResponse.json({ pattern });
  }
  if (isAdminUser(user)) {
    return NextResponse.json({ pattern });
  }

  return NextResponse.json({ error: '无权查看该图纸' }, { status: 403 });
}

/** 删除本人图纸；本地删除后由客户端调用此接口清理云端记录 */
export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: '缺少图纸 id' }, { status: 400 });

  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const db = await getDB();
  if (!db) return NextResponse.json({ error: 'D1 未绑定' }, { status: 503 });

  const existing = await db
    .prepare('SELECT owner_id, data_json FROM patterns WHERE id = ?')
    .bind(id)
    .first<{ owner_id: string; data_json: string }>();
  if (!existing) return NextResponse.json({ error: '图纸不存在' }, { status: 404 });
  if (existing.owner_id !== userId) return NextResponse.json({ error: '无权删除该图纸' }, { status: 403 });

  await db.prepare('DELETE FROM patterns WHERE id = ? AND owner_id = ?').bind(id, userId).run();
  try {
    const data = JSON.parse(existing.data_json) as { originalImageKey?: unknown };
    const key = typeof data.originalImageKey === 'string' ? data.originalImageKey : null;
    if (key) {
      const bucket = await getR2();
      if (bucket) await bucket.delete(key);
    }
  } catch {
    // 图纸记录已删除；对象清理失败不应让删除请求变成失败
  }
  return NextResponse.json({ ok: true });
}
