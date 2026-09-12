import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.startsWith('multipart/form-data')) return NextResponse.json({ error: '请使用 multipart/form-data 上传图片' }, { status: 400 });
  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: '缺少图片文件' }, { status: 400 });
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return NextResponse.json({ error: '仅支持 JPG、PNG 和 WebP' }, { status: 415 });
  if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: '图片不能超过 10MB' }, { status: 413 });
  return NextResponse.json({ error: 'R2 绑定尚未注入当前运行环境' }, { status: 501 });
}
