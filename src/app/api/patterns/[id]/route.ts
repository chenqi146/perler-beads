import { NextResponse } from 'next/server';
import { getCurrentUser } from '../../../../lib/auth';
import { isAdminUser } from '../../../../lib/admin';
import { getPatternById } from '../../../../lib/patternQueries';
import { getSessionUserId } from '../../../../lib/session';

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
