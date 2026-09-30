import { NextResponse } from 'next/server';
import { isErrorResponse, requireRegisteredApi } from '../../../../lib/inventoryAuth';
import { listMovements } from '../../../../lib/inventoryQueries';

export async function GET(request: Request) {
  const auth = await requireRegisteredApi();
  if (isErrorResponse(auth)) return auth;

  const { searchParams } = new URL(request.url);
  const limit = Number(searchParams.get('limit') || 50);
  const offset = Number(searchParams.get('offset') || 0);

  const { data, available } = await listMovements(auth.id, { limit, offset });
  if (!available) {
    return NextResponse.json({ error: 'D1 未绑定' }, { status: 503 });
  }
  return NextResponse.json({ movements: data });
}
