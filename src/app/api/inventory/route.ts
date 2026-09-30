import { NextResponse } from 'next/server';
import { isErrorResponse, requireRegisteredApi } from '../../../lib/inventoryAuth';
import { listColorStock } from '../../../lib/inventoryQueries';

export async function GET(request: Request) {
  const auth = await requireRegisteredApi();
  if (isErrorResponse(auth)) return auth;

  const { searchParams } = new URL(request.url);
  const includeEmpty = searchParams.get('includeEmpty') === '1';

  const { data, available } = await listColorStock(auth.id, { includeEmpty });
  if (!available) {
    return NextResponse.json({ error: 'D1 未绑定' }, { status: 503 });
  }
  return NextResponse.json(data);
}
