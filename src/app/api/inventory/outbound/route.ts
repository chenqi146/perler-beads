import { NextResponse } from 'next/server';
import type { OutboundDraft, OutboundReason } from '../../../../domain/inventory';
import { isErrorResponse, requireRegisteredApi } from '../../../../lib/inventoryAuth';
import { postOutbound, previewOutboundFifo } from '../../../../lib/inventoryQueries';

export async function POST(request: Request) {
  const auth = await requireRegisteredApi();
  if (isErrorResponse(auth)) return auth;

  const body = await request.json().catch(() => null);
  if (!body || !Array.isArray(body.lines)) {
    return NextResponse.json({ error: '无效请求体' }, { status: 400 });
  }

  if (body.preview === true) {
    const preview = await previewOutboundFifo(
      auth.id,
      body.lines.map((line: { hex?: string; quantity?: number }) => ({
        hex: String(line.hex || ''),
        quantity: Number(line.quantity),
      })),
    );
    if (!preview.ok) {
      return NextResponse.json(
        { error: preview.error, shortfallHex: preview.shortfallHex },
        { status: 409 },
      );
    }
    return NextResponse.json({ preview: preview.byHex });
  }

  const draft: OutboundDraft = {
    note: body.note ? String(body.note) : '',
    reason: (body.reason as OutboundReason) || 'craft',
    craftSessionId: body.craftSessionId ? String(body.craftSessionId) : null,
    lines: body.lines.map((line: { hex?: string; quantity?: number }) => ({
      hex: String(line.hex || ''),
      quantity: Number(line.quantity),
    })),
  };

  const result = await postOutbound(auth.id, draft);
  if (!result.ok) {
    return NextResponse.json(
      {
        error: result.error,
        shortfallHex: result.shortfallHex,
        shortfallHexes: result.shortfallHexes,
      },
      { status: result.status },
    );
  }
  return NextResponse.json({
    outboundId: result.outboundId,
    idempotent: result.idempotent === true,
  });
}
