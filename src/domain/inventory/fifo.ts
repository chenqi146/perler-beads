import type { FifoAllocation, FifoLotSlice } from './types';

/**
 * 按 created_at 已升序的批次列表，FIFO 分配出库量。
 * 不足时 ok=false，allocations 为空（调用方应整单失败）。
 */
export function allocateFifo(
  lots: FifoLotSlice[],
  need: number,
): { ok: boolean; allocations: FifoAllocation[] } {
  if (!Number.isFinite(need) || need <= 0) {
    return { ok: false, allocations: [] };
  }

  const available = lots.reduce((sum, lot) => sum + Math.max(0, lot.remainingQty), 0);
  if (available < need) {
    return { ok: false, allocations: [] };
  }

  let left = need;
  const allocations: FifoAllocation[] = [];
  for (const lot of lots) {
    if (left <= 0) break;
    const take = Math.min(Math.max(0, lot.remainingQty), left);
    if (take <= 0) continue;
    allocations.push({ lotId: lot.id, quantity: take });
    left -= take;
  }

  if (left > 0) {
    return { ok: false, allocations: [] };
  }
  return { ok: true, allocations };
}

/** 预览多色出库的 FIFO 分配（不改库存） */
export function previewFifoAllocations(
  lotsByHex: Map<string, FifoLotSlice[]>,
  lines: { hex: string; quantity: number }[],
): { ok: boolean; byHex: Record<string, FifoAllocation[]>; shortfallHex?: string } {
  const byHex: Record<string, FifoAllocation[]> = {};
  // 同色多行合并后再分配，避免重复读批次
  const merged = new Map<string, number>();
  for (const line of lines) {
    const hex = line.hex.toUpperCase();
    merged.set(hex, (merged.get(hex) ?? 0) + line.quantity);
  }

  for (const [hex, qty] of merged) {
    const lots = lotsByHex.get(hex) ?? [];
    const result = allocateFifo(lots, qty);
    if (!result.ok) {
      return { ok: false, byHex: {}, shortfallHex: hex };
    }
    byHex[hex] = result.allocations;
  }
  return { ok: true, byHex };
}
