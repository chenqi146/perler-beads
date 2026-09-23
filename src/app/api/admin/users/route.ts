import { NextResponse } from 'next/server';
import { requireAdminApi } from '../../../../lib/admin';
import { listUsersForAdmin } from '../../../../lib/adminQueries';

export async function GET() {
  const admin = await requireAdminApi();
  if (admin instanceof Response) return admin;

  const { items, available } = await listUsersForAdmin();
  if (!available) {
    return NextResponse.json({ users: [], message: 'D1 未绑定' }, { status: 503 });
  }
  return NextResponse.json({ users: items });
}
