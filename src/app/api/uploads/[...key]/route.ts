import { NextResponse } from 'next/server';
import { getR2 } from '../../../../lib/d1';

type Ctx = { params: Promise<{ key: string[] }> };

/** GET /api/uploads/works/{userId}/{file} */
export async function GET(_request: Request, context: Ctx) {
  const parts = (await context.params).key || [];
  const raw = parts.map(decodeURIComponent).join('/');
  if (!raw || raw.includes('..') || !raw.startsWith('works/')) {
    return NextResponse.json({ error: '无效 key' }, { status: 400 });
  }

  const r2 = getR2();
  if (!r2) return NextResponse.json({ error: 'R2 未绑定' }, { status: 503 });

  const obj = await r2.get(raw);
  if (!obj) return NextResponse.json({ error: '文件不存在' }, { status: 404 });

  return new NextResponse(obj.body, {
    headers: {
      'Content-Type': obj.httpMetadata?.contentType || 'application/octet-stream',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
