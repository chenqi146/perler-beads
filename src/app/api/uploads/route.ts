import { NextResponse } from 'next/server';
import { getR2 } from '../../../lib/d1';
import { getSessionUserId } from '../../../lib/session';

function extForType(type: string): string {
  if (type === 'image/png') return 'png';
  if (type === 'image/webp') return 'webp';
  return 'jpg';
}

export async function POST(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const contentType = request.headers.get('content-type') || '';
  if (!contentType.startsWith('multipart/form-data')) {
    return NextResponse.json({ error: '请使用 multipart/form-data 上传图片' }, { status: 400 });
  }

  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: '缺少图片文件' }, { status: 400 });
  }
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    return NextResponse.json({ error: '仅支持 JPG、PNG 和 WebP' }, { status: 415 });
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: '图片不能超过 10MB' }, { status: 413 });
  }

  const r2 = await getR2();
  if (!r2) {
    return NextResponse.json({ error: 'R2 未绑定' }, { status: 503 });
  }

  const purpose = String(form.get('purpose') || 'work');
  const patternIdRaw = String(form.get('patternId') || '').trim();
  const ext = extForType(file.type);

  let key: string;
  if (purpose === 'pattern') {
    const patternId = patternIdRaw.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 120);
    if (!patternId) {
      return NextResponse.json({ error: '缺少 patternId' }, { status: 400 });
    }
    key = `patterns/${userId}/${patternId}.${ext}`;
  } else {
    key = `works/${userId}/${crypto.randomUUID()}.${ext}`;
  }

  const buffer = await file.arrayBuffer();
  await r2.put(key, buffer, { httpMetadata: { contentType: file.type } });

  const url = `/api/uploads/${key.split('/').map(encodeURIComponent).join('/')}`;
  return NextResponse.json({ key, url });
}
