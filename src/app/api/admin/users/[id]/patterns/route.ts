import { NextResponse } from 'next/server';
import { requireAdminApi } from '../../../../../../lib/admin';
import { getUserForAdmin, listPatternsForAdminOwner } from '../../../../../../lib/adminQueries';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const admin = await requireAdminApi();
  if (admin instanceof Response) return admin;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: '缺少用户 id' }, { status: 400 });
  }

  const { user, available: userOk } = await getUserForAdmin(id);
  if (!userOk) {
    return NextResponse.json({ error: 'D1 未绑定' }, { status: 503 });
  }
  if (!user) {
    return NextResponse.json({ error: '用户不存在' }, { status: 404 });
  }

  const { items, available } = await listPatternsForAdminOwner(id);
  if (!available) {
    return NextResponse.json({ error: 'D1 未绑定' }, { status: 503 });
  }

  return NextResponse.json({ user, patterns: items });
}
