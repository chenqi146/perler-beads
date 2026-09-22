import { NextResponse } from 'next/server';
import { getR2 } from '../../../../lib/d1';
import { getSessionUserId } from '../../../../lib/session';

type Ctx = { params: Promise<{ key: string[] }> };

/** GET /api/uploads/works|patterns/{userId}/{file} */
export async function GET(_request: Request, context: Ctx) {
  const parts = (await context.params).key || [];
  const raw = parts.map(decodeURIComponent).join('/');
  if (!raw || raw.includes('..')) {
    return NextResponse.json({ error: '无效 key' }, { status: 400 });
  }

  const isWork = raw.startsWith('works/');
  const isPattern = raw.startsWith('patterns/');
  if (!isWork && !isPattern) {
    return NextResponse.json({ error: '无效 key' }, { status: 400 });
  }

  // 图纸原图需登录且只能访问自己的
  if (isPattern) {
    const userId = await getSessionUserId();
    if (!userId) return NextResponse.json({ error: '未登录' }, { status: 401 });
    const owner = raw.split('/')[1];
    if (owner !== userId) {
      return NextResponse.json({ error: '无权访问' }, { status: 403 });
    }
  }

  const r2 = await getR2();
  if (!r2) return NextResponse.json({ error: 'R2 未绑定' }, { status: 503 });

  const obj = await r2.get(raw);
  if (!obj) return NextResponse.json({ error: '文件不存在' }, { status: 404 });

  return new NextResponse(obj.body, {
    headers: {
      'Content-Type': obj.httpMetadata?.contentType || 'application/octet-stream',
      'Cache-Control': isPattern
        ? 'private, max-age=3600'
        : 'public, max-age=31536000, immutable',
    },
  });
}
