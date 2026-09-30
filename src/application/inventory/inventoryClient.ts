/**
 * 豆仓客户端 API 封装
 */
import { apiFetch } from '../../utils/apiClient';
import type {
  BeadLot,
  ColorStock,
  InboundDraft,
  InboundSource,
  InventoryMovement,
  InventorySnapshot,
  OutboundDraft,
  OutboundReason,
} from '../../domain/inventory';

async function readError(res: Response): Promise<string> {
  const data = await res.json().catch(() => ({}));
  return typeof data.error === 'string' ? data.error : `请求失败 (${res.status})`;
}

export async function fetchInventoryStock(includeEmpty = false): Promise<InventorySnapshot> {
  const res = await apiFetch(
    `/api/inventory?includeEmpty=${includeEmpty ? '1' : '0'}`,
    undefined,
    { authRedirect: true, unauthorizedMessage: '请登录账号后使用豆仓' },
  );
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function fetchInventoryLots(
  hex?: string,
  includeEmpty = false,
): Promise<BeadLot[]> {
  const params = new URLSearchParams();
  if (hex) params.set('hex', hex);
  if (includeEmpty) params.set('includeEmpty', '1');
  const res = await apiFetch(`/api/inventory/lots?${params}`, undefined, {
    authRedirect: true,
  });
  if (!res.ok) throw new Error(await readError(res));
  const data = await res.json();
  return Array.isArray(data.lots) ? data.lots : [];
}

export async function fetchInventoryMovements(): Promise<InventoryMovement[]> {
  const res = await apiFetch('/api/inventory/movements', undefined, { authRedirect: true });
  if (!res.ok) throw new Error(await readError(res));
  const data = await res.json();
  return Array.isArray(data.movements) ? data.movements : [];
}

export async function submitInbound(draft: InboundDraft): Promise<string> {
  const res = await apiFetch(
    '/api/inventory/inbound',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draft),
    },
    { authRedirect: true },
  );
  if (!res.ok) throw new Error(await readError(res));
  const data = await res.json();
  return String(data.inboundId);
}

export async function submitInboundCsv(csv: string, colorSystem: string, note?: string) {
  const res = await apiFetch(
    '/api/inventory/inbound/csv',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csv, colorSystem, note }),
    },
    { authRedirect: true },
  );
  if (!res.ok) throw new Error(await readError(res));
  return res.json() as Promise<{ inboundId: string; imported: number; parseWarnings: string[] }>;
}

export class InventoryApiError extends Error {
  status: number;
  shortfallHex?: string;
  shortfallHexes?: string[];

  constructor(
    message: string,
    status: number,
    extra?: { shortfallHex?: string; shortfallHexes?: string[] },
  ) {
    super(message);
    this.name = 'InventoryApiError';
    this.status = status;
    this.shortfallHex = extra?.shortfallHex;
    this.shortfallHexes = extra?.shortfallHexes;
  }
}

async function readErrorPayload(res: Response): Promise<{
  message: string;
  shortfallHex?: string;
  shortfallHexes?: string[];
}> {
  const data = await res.json().catch(() => ({}));
  return {
    message: typeof data.error === 'string' ? data.error : `请求失败 (${res.status})`,
    shortfallHex: typeof data.shortfallHex === 'string' ? data.shortfallHex : undefined,
    shortfallHexes: Array.isArray(data.shortfallHexes)
      ? data.shortfallHexes.map(String)
      : undefined,
  };
}

export async function submitOutbound(
  draft: OutboundDraft,
): Promise<{ outboundId: string; idempotent: boolean }> {
  const res = await apiFetch(
    '/api/inventory/outbound',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draft),
    },
    { authRedirect: true },
  );
  if (!res.ok) {
    const payload = await readErrorPayload(res);
    throw new InventoryApiError(payload.message, res.status, payload);
  }
  const data = await res.json();
  return {
    outboundId: String(data.outboundId),
    idempotent: data.idempotent === true,
  };
}

export async function previewOutbound(lines: { hex: string; quantity: number }[]) {
  const res = await apiFetch(
    '/api/inventory/outbound',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preview: true, lines }),
    },
    { authRedirect: true },
  );
  if (!res.ok) {
    const payload = await readErrorPayload(res);
    throw new InventoryApiError(payload.message, res.status, payload);
  }
  return res.json() as Promise<{
    preview: Record<string, { lotId: string; quantity: number; remainingAfter: number }[]>;
  }>;
}

export async function voidInboundDoc(id: string) {
  const res = await apiFetch(
    `/api/inventory/inbound/${id}/void`,
    { method: 'POST' },
    { authRedirect: true },
  );
  if (!res.ok) throw new Error(await readError(res));
}

export async function voidOutboundDoc(id: string) {
  const res = await apiFetch(
    `/api/inventory/outbound/${id}/void`,
    { method: 'POST' },
    { authRedirect: true },
  );
  if (!res.ok) throw new Error(await readError(res));
}

export type { ColorStock, InboundSource, OutboundReason, BeadLot, InventoryMovement };
