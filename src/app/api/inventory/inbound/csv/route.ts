import { NextResponse } from 'next/server';
import type { ColorSystem } from '../../../../../domain/palette';
import { colorSystemOptions } from '../../../../../domain/palette';
import { parseInboundCsv } from '../../../../../domain/inventory';
import { isErrorResponse, requireRegisteredApi } from '../../../../../lib/inventoryAuth';
import { postInbound } from '../../../../../lib/inventoryQueries';

const VALID_SYSTEMS = new Set(colorSystemOptions.map((o) => o.key));

export async function POST(request: Request) {
  const auth = await requireRegisteredApi();
  if (isErrorResponse(auth)) return auth;

  const body = await request.json().catch(() => null);
  const csvText = String(body?.csv || body?.text || '');
  if (!csvText.trim()) {
    return NextResponse.json({ error: '缺少 CSV 内容' }, { status: 400 });
  }

  const colorSystem = (
    VALID_SYSTEMS.has(body?.colorSystem) ? body.colorSystem : 'MARD'
  ) as ColorSystem;

  const parsed = parseInboundCsv(csvText, colorSystem);
  if (parsed.errors.length && parsed.lines.length === 0) {
    return NextResponse.json({ error: 'CSV 解析失败', details: parsed.errors }, { status: 400 });
  }

  const result = await postInbound(auth.id, {
    note: body?.note ? String(body.note) : 'CSV 批量入库',
    source: 'csv',
    lines: parsed.lines,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, parseWarnings: parsed.errors },
      { status: result.status },
    );
  }

  return NextResponse.json({
    inboundId: result.inboundId,
    imported: parsed.lines.length,
    parseWarnings: parsed.errors,
  });
}
