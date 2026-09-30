import type { D1Database, D1PreparedStatement } from './d1';
import { getDB } from './d1';
import { allocateFifo } from '../domain/inventory/fifo';
import { normalizeInventoryHex } from '../domain/inventory/hex';
import {
  INBOUND_SOURCE_LABELS,
  OUTBOUND_REASON_LABELS,
} from '../domain/inventory/labels';
import type {
  BeadLot,
  ColorStock,
  DocumentStatus,
  InboundDraft,
  InboundSource,
  InventoryMovement,
  InventorySnapshot,
  OutboundDraft,
  OutboundReason,
} from '../domain/inventory/types';

type QueryResult<T> = { data: T; available: boolean };

type LotRow = {
  id: string;
  hex: string;
  original_qty: number;
  remaining_qty: number;
  note: string;
  inbound_id: string;
  created_at: number;
  updated_at: number;
};

async function runBatch(db: D1Database, statements: D1PreparedStatement[]): Promise<void> {
  if (statements.length === 0) return;
  if (typeof db.batch === 'function') {
    await db.batch(statements);
    return;
  }
  for (const stmt of statements) {
    await stmt.run();
  }
}

function mapLot(row: LotRow): BeadLot {
  return {
    id: row.id,
    hex: row.hex,
    originalQty: row.original_qty,
    remainingQty: row.remaining_qty,
    note: row.note || '',
    inboundId: row.inbound_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listColorStock(
  userId: string,
  options: { includeEmpty?: boolean } = {},
): Promise<QueryResult<InventorySnapshot>> {
  const db = await getDB();
  if (!db) return { data: { items: [], totalBeads: 0, colorCount: 0 }, available: false };

  const rows = await db
    .prepare(
      `SELECT hex,
              SUM(remaining_qty) AS quantity,
              SUM(CASE WHEN remaining_qty > 0 THEN 1 ELSE 0 END) AS lot_count,
              MAX(updated_at) AS updated_at
       FROM bead_lot
       WHERE user_id = ?
       GROUP BY hex
       ORDER BY hex ASC`,
    )
    .bind(userId)
    .all<{ hex: string; quantity: number; lot_count: number; updated_at: number }>();

  let items: ColorStock[] = (rows.results || []).map((row) => ({
    hex: row.hex,
    quantity: Number(row.quantity) || 0,
    lotCount: Number(row.lot_count) || 0,
    updatedAt: Number(row.updated_at) || 0,
  }));

  if (!options.includeEmpty) {
    items = items.filter((item) => item.quantity > 0);
  }

  const totalBeads = items.reduce((sum, item) => sum + item.quantity, 0);
  return {
    data: { items, totalBeads, colorCount: items.length },
    available: true,
  };
}

export async function listLotsByHex(
  userId: string,
  hex?: string | null,
  options: { includeEmpty?: boolean } = {},
): Promise<QueryResult<BeadLot[]>> {
  const db = await getDB();
  if (!db) return { data: [], available: false };

  const includeEmpty = options.includeEmpty === true;
  let rows: { results: LotRow[] };

  if (hex) {
    const normalized = normalizeInventoryHex(hex);
    if (!normalized) return { data: [], available: true };
    rows = await db
      .prepare(
        `SELECT id, hex, original_qty, remaining_qty, note, inbound_id, created_at, updated_at
         FROM bead_lot
         WHERE user_id = ? AND hex = ?
         ${includeEmpty ? '' : 'AND remaining_qty > 0'}
         ORDER BY created_at ASC`,
      )
      .bind(userId, normalized)
      .all<LotRow>();
  } else {
    rows = await db
      .prepare(
        `SELECT id, hex, original_qty, remaining_qty, note, inbound_id, created_at, updated_at
         FROM bead_lot
         WHERE user_id = ?
         ${includeEmpty ? '' : 'AND remaining_qty > 0'}
         ORDER BY hex ASC, created_at ASC`,
      )
      .bind(userId)
      .all<LotRow>();
  }

  return { data: (rows.results || []).map(mapLot), available: true };
}

function validateInboundDraft(draft: InboundDraft): string | null {
  if (!draft.lines?.length) return '至少需要一行入库明细';
  const sources: InboundSource[] = ['purchase', 'open_balance', 'adjust', 'csv'];
  if (!sources.includes(draft.source)) return '无效的入库来源';
  for (const line of draft.lines) {
    if (!normalizeInventoryHex(line.hex)) return `无效色号：${line.hex}`;
    if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
      return '数量必须为正整数';
    }
  }
  return null;
}

export async function postInbound(
  userId: string,
  draft: InboundDraft,
): Promise<{ ok: true; inboundId: string } | { ok: false; error: string; status: number }> {
  const db = await getDB();
  if (!db) return { ok: false, error: 'D1 未绑定', status: 503 };

  const validationError = validateInboundDraft(draft);
  if (validationError) return { ok: false, error: validationError, status: 400 };

  const inboundId = crypto.randomUUID();
  const now = Date.now();
  const note = String(draft.note || '').slice(0, 500);
  const statements: D1PreparedStatement[] = [
    db
      .prepare(
        `INSERT INTO bead_inbound (id, user_id, note, source, status, created_at, voided_at)
         VALUES (?, ?, ?, ?, 'posted', ?, NULL)`,
      )
      .bind(inboundId, userId, note, draft.source, now),
  ];

  for (const line of draft.lines) {
    const hex = normalizeInventoryHex(line.hex)!;
    const lineId = crypto.randomUUID();
    const lotId = crypto.randomUUID();
    const lineNote = String(line.note || '').slice(0, 200);
    statements.push(
      db
        .prepare(
          `INSERT INTO bead_inbound_line (id, inbound_id, user_id, hex, quantity, lot_id)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .bind(lineId, inboundId, userId, hex, line.quantity, lotId),
      db
        .prepare(
          `INSERT INTO bead_lot
             (id, user_id, hex, inbound_id, inbound_line_id, original_qty, remaining_qty, note, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          lotId,
          userId,
          hex,
          inboundId,
          lineId,
          line.quantity,
          line.quantity,
          lineNote,
          now,
          now,
        ),
    );
  }

  try {
    await runBatch(db, statements);
  } catch (err) {
    console.error('[inventory] postInbound failed', err);
    return { ok: false, error: '入库失败', status: 500 };
  }

  return { ok: true, inboundId };
}

function validateOutboundDraft(draft: OutboundDraft): string | null {
  if (!draft.lines?.length) return '至少需要一行出库明细';
  const reasons: OutboundReason[] = ['craft', 'waste', 'adjust', 'other'];
  if (!reasons.includes(draft.reason)) return '无效的出库原因';
  for (const line of draft.lines) {
    if (!normalizeInventoryHex(line.hex)) return `无效色号：${line.hex}`;
    if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
      return '数量必须为正整数';
    }
  }
  return null;
}

export async function postOutbound(
  userId: string,
  draft: OutboundDraft,
): Promise<
  | { ok: true; outboundId: string; idempotent?: boolean }
  | { ok: false; error: string; status: number; shortfallHex?: string; shortfallHexes?: string[] }
> {
  const db = await getDB();
  if (!db) return { ok: false, error: 'D1 未绑定', status: 503 };

  const validationError = validateOutboundDraft(draft);
  if (validationError) return { ok: false, error: validationError, status: 400 };

  const craftSessionId = draft.craftSessionId ? String(draft.craftSessionId) : null;
  if (craftSessionId) {
    const existing = await db
      .prepare(
        `SELECT id FROM bead_outbound
         WHERE user_id = ? AND craft_session_id = ? AND status = 'posted'
         LIMIT 1`,
      )
      .bind(userId, craftSessionId)
      .first<{ id: string }>();
    if (existing?.id) {
      return { ok: true, outboundId: existing.id, idempotent: true };
    }
  }

  // 合并同色
  const merged = new Map<string, number>();
  for (const line of draft.lines) {
    const hex = normalizeInventoryHex(line.hex)!;
    merged.set(hex, (merged.get(hex) ?? 0) + line.quantity);
  }

  const shortfallHexes: string[] = [];
  const lotsCache = new Map<string, { id: string; remainingQty: number }[]>();

  for (const [hex, quantity] of merged) {
    const lotRows = await db
      .prepare(
        `SELECT id, remaining_qty AS remainingQty
         FROM bead_lot
         WHERE user_id = ? AND hex = ? AND remaining_qty > 0
         ORDER BY created_at ASC`,
      )
      .bind(userId, hex)
      .all<{ id: string; remainingQty: number }>();

    const lots = (lotRows.results || []).map((r) => ({
      id: r.id,
      remainingQty: Number(r.remainingQty),
    }));
    lotsCache.set(hex, lots);
    const fifo = allocateFifo(lots, quantity);
    if (!fifo.ok) shortfallHexes.push(hex);
  }

  if (shortfallHexes.length) {
    return {
      ok: false,
      error: `库存不足：${shortfallHexes.join(', ')}`,
      status: 409,
      shortfallHex: shortfallHexes[0],
      shortfallHexes,
    };
  }

  const allocationsByHex = new Map<
    string,
    { lineId: string; quantity: number; allocations: { lotId: string; quantity: number }[] }
  >();

  for (const [hex, quantity] of merged) {
    const fifo = allocateFifo(lotsCache.get(hex) || [], quantity);
    allocationsByHex.set(hex, {
      lineId: crypto.randomUUID(),
      quantity,
      allocations: fifo.allocations,
    });
  }

  const outboundId = crypto.randomUUID();
  const now = Date.now();
  const note = String(draft.note || '').slice(0, 500);

  const statements: D1PreparedStatement[] = [
    db
      .prepare(
        `INSERT INTO bead_outbound
           (id, user_id, note, reason, craft_session_id, status, created_at, voided_at)
         VALUES (?, ?, ?, ?, ?, 'posted', ?, NULL)`,
      )
      .bind(outboundId, userId, note, draft.reason, craftSessionId, now),
  ];

  for (const [hex, entry] of allocationsByHex) {
    statements.push(
      db
        .prepare(
          `INSERT INTO bead_outbound_line (id, outbound_id, user_id, hex, quantity)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .bind(entry.lineId, outboundId, userId, hex, entry.quantity),
    );
    for (const alloc of entry.allocations) {
      const allocId = crypto.randomUUID();
      statements.push(
        db
          .prepare(
            `INSERT INTO bead_outbound_allocation
               (id, outbound_id, outbound_line_id, lot_id, user_id, hex, quantity)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(allocId, outboundId, entry.lineId, alloc.lotId, userId, hex, alloc.quantity),
        db
          .prepare(
            `UPDATE bead_lot
             SET remaining_qty = remaining_qty - ?, updated_at = ?
             WHERE id = ? AND user_id = ? AND remaining_qty >= ?`,
          )
          .bind(alloc.quantity, now, alloc.lotId, userId, alloc.quantity),
      );
    }
  }

  try {
    await runBatch(db, statements);
  } catch (err) {
    console.error('[inventory] postOutbound failed', err);
    return { ok: false, error: '出库失败', status: 500 };
  }

  return { ok: true, outboundId };
}

export async function voidInbound(
  userId: string,
  inboundId: string,
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const db = await getDB();
  if (!db) return { ok: false, error: 'D1 未绑定', status: 503 };

  const doc = await db
    .prepare(`SELECT id, status FROM bead_inbound WHERE id = ? AND user_id = ?`)
    .bind(inboundId, userId)
    .first<{ id: string; status: DocumentStatus }>();

  if (!doc) return { ok: false, error: '入库单不存在', status: 404 };
  if (doc.status === 'voided') return { ok: false, error: '入库单已作废', status: 400 };

  const touched = await db
    .prepare(
      `SELECT id FROM bead_lot
       WHERE user_id = ? AND inbound_id = ? AND remaining_qty <> original_qty
       LIMIT 1`,
    )
    .bind(userId, inboundId)
    .first<{ id: string }>();

  if (touched) {
    return { ok: false, error: '批次已被出库消耗，无法作废该入库单', status: 409 };
  }

  const now = Date.now();
  try {
    await runBatch(db, [
      db
        .prepare(
          `UPDATE bead_inbound SET status = 'voided', voided_at = ? WHERE id = ? AND user_id = ?`,
        )
        .bind(now, inboundId, userId),
      db
        .prepare(`DELETE FROM bead_lot WHERE user_id = ? AND inbound_id = ?`)
        .bind(userId, inboundId),
    ]);
  } catch (err) {
    console.error('[inventory] voidInbound failed', err);
    return { ok: false, error: '作废失败', status: 500 };
  }

  return { ok: true };
}

export async function voidOutbound(
  userId: string,
  outboundId: string,
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const db = await getDB();
  if (!db) return { ok: false, error: 'D1 未绑定', status: 503 };

  const doc = await db
    .prepare(`SELECT id, status FROM bead_outbound WHERE id = ? AND user_id = ?`)
    .bind(outboundId, userId)
    .first<{ id: string; status: DocumentStatus }>();

  if (!doc) return { ok: false, error: '出库单不存在', status: 404 };
  if (doc.status === 'voided') return { ok: false, error: '出库单已作废', status: 400 };

  const allocs = await db
    .prepare(
      `SELECT lot_id, quantity FROM bead_outbound_allocation
       WHERE outbound_id = ? AND user_id = ?`,
    )
    .bind(outboundId, userId)
    .all<{ lot_id: string; quantity: number }>();

  const now = Date.now();
  const statements: D1PreparedStatement[] = [
    db
      .prepare(
        `UPDATE bead_outbound SET status = 'voided', voided_at = ? WHERE id = ? AND user_id = ?`,
      )
      .bind(now, outboundId, userId),
  ];

  for (const alloc of allocs.results || []) {
    statements.push(
      db
        .prepare(
          `UPDATE bead_lot
           SET remaining_qty = remaining_qty + ?, updated_at = ?
           WHERE id = ? AND user_id = ?`,
        )
        .bind(alloc.quantity, now, alloc.lot_id, userId),
    );
  }

  try {
    await runBatch(db, statements);
  } catch (err) {
    console.error('[inventory] voidOutbound failed', err);
    return { ok: false, error: '作废失败', status: 500 };
  }

  return { ok: true };
}

export async function listMovements(
  userId: string,
  options: { limit?: number; offset?: number } = {},
): Promise<QueryResult<InventoryMovement[]>> {
  const db = await getDB();
  if (!db) return { data: [], available: false };

  const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);
  const offset = Math.max(options.offset ?? 0, 0);

  const inboundRows = await db
    .prepare(
      `SELECT i.id, i.status, i.note, i.source, i.created_at, i.voided_at,
              COUNT(l.id) AS line_count,
              COALESCE(SUM(l.quantity), 0) AS total_qty
       FROM bead_inbound i
       LEFT JOIN bead_inbound_line l ON l.inbound_id = i.id
       WHERE i.user_id = ?
       GROUP BY i.id
       ORDER BY i.created_at DESC
       LIMIT ? OFFSET ?`,
    )
    .bind(userId, limit, offset)
    .all<{
      id: string;
      status: DocumentStatus;
      note: string;
      source: InboundSource;
      created_at: number;
      voided_at: number | null;
      line_count: number;
      total_qty: number;
    }>();

  const outboundRows = await db
    .prepare(
      `SELECT o.id, o.status, o.note, o.reason, o.created_at, o.voided_at,
              COUNT(l.id) AS line_count,
              COALESCE(SUM(l.quantity), 0) AS total_qty
       FROM bead_outbound o
       LEFT JOIN bead_outbound_line l ON l.outbound_id = o.id
       WHERE o.user_id = ?
       GROUP BY o.id
       ORDER BY o.created_at DESC
       LIMIT ? OFFSET ?`,
    )
    .bind(userId, limit, offset)
    .all<{
      id: string;
      status: DocumentStatus;
      note: string;
      reason: OutboundReason;
      created_at: number;
      voided_at: number | null;
      line_count: number;
      total_qty: number;
    }>();

  const movements: InventoryMovement[] = [
    ...(inboundRows.results || []).map((row) => ({
      id: row.id,
      kind: 'inbound' as const,
      status: row.status,
      label: INBOUND_SOURCE_LABELS[row.source] || row.source,
      note: row.note || '',
      lineCount: Number(row.line_count) || 0,
      totalQty: Number(row.total_qty) || 0,
      createdAt: row.created_at,
      voidedAt: row.voided_at,
    })),
    ...(outboundRows.results || []).map((row) => ({
      id: row.id,
      kind: 'outbound' as const,
      status: row.status,
      label: OUTBOUND_REASON_LABELS[row.reason] || row.reason,
      note: row.note || '',
      lineCount: Number(row.line_count) || 0,
      totalQty: Number(row.total_qty) || 0,
      createdAt: row.created_at,
      voidedAt: row.voided_at,
    })),
  ]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, limit);

  return { data: movements, available: true };
}

export async function previewOutboundFifo(
  userId: string,
  lines: { hex: string; quantity: number }[],
): Promise<
  | { ok: true; byHex: Record<string, { lotId: string; quantity: number; remainingAfter: number }[]> }
  | { ok: false; error: string; shortfallHex?: string }
> {
  const db = await getDB();
  if (!db) return { ok: false, error: 'D1 未绑定' };

  const merged = new Map<string, number>();
  for (const line of lines) {
    const hex = normalizeInventoryHex(line.hex);
    if (!hex) return { ok: false, error: `无效色号：${line.hex}` };
    if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
      return { ok: false, error: '数量必须为正整数' };
    }
    merged.set(hex, (merged.get(hex) ?? 0) + line.quantity);
  }

  const byHex: Record<string, { lotId: string; quantity: number; remainingAfter: number }[]> = {};

  for (const [hex, quantity] of merged) {
    const lotRows = await db
      .prepare(
        `SELECT id, remaining_qty AS remainingQty
         FROM bead_lot
         WHERE user_id = ? AND hex = ? AND remaining_qty > 0
         ORDER BY created_at ASC`,
      )
      .bind(userId, hex)
      .all<{ id: string; remainingQty: number }>();

    const lots = (lotRows.results || []).map((r) => ({
      id: r.id,
      remainingQty: Number(r.remainingQty),
    }));
    const fifo = allocateFifo(lots, quantity);
    if (!fifo.ok) {
      return { ok: false, error: `库存不足：${hex}`, shortfallHex: hex };
    }

    const remainingMap = new Map(lots.map((l) => [l.id, l.remainingQty]));
    byHex[hex] = fifo.allocations.map((alloc) => {
      const before = remainingMap.get(alloc.lotId) ?? 0;
      const after = before - alloc.quantity;
      remainingMap.set(alloc.lotId, after);
      return { lotId: alloc.lotId, quantity: alloc.quantity, remainingAfter: after };
    });
  }

  return { ok: true, byHex };
}
