import { NextResponse } from 'next/server';
import type { InboundDraft, InboundSource } from '../../../../domain/inventory';
import { isErrorResponse, requireRegisteredApi } from '../../../../lib/inventoryAuth';
import { postInbound } from '../../../../lib/inventoryQueries';

export async function POST(request: Request) {
  const auth = await requireRegisteredApi();
  if (isErrorResponse(auth)) return auth;

  const body = await request.json().catch(() => null);
  if (!body || !Array.isArray(body.lines)) {
    return NextResponse.json({ error: '无效请求体' }, { status: 400 });
  }

  const draft: InboundDraft = {
    note: body.note ? String(body.note) : '',
    source: (body.source as InboundSource) || 'purchase',
    lines: body.lines.map((line: { hex?: string; quantity?: number; note?: string }) => ({
      hex: String(line.hex || ''),
      quantity: Number(line.quantity),
      note: line.note ? String(line.note) : undefined,
    })),
  };

  const result = await postInbound(auth.id, draft);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ inboundId: result.inboundId });
}
