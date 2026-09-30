import { NextResponse } from 'next/server';
import { isErrorResponse, requireRegisteredApi } from '../../../../../../lib/inventoryAuth';
import { voidInbound } from '../../../../../../lib/inventoryQueries';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_request: Request, ctx: Ctx) {
  const auth = await requireRegisteredApi();
  if (isErrorResponse(auth)) return auth;

  const { id } = await ctx.params;
  const result = await voidInbound(auth.id, id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ ok: true });
}
