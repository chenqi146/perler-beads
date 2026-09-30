export type InboundSource = 'purchase' | 'open_balance' | 'adjust' | 'csv';
export type OutboundReason = 'craft' | 'waste' | 'adjust' | 'other';
export type DocumentStatus = 'posted' | 'voided';

export type BeadLot = {
  id: string;
  hex: string;
  originalQty: number;
  remainingQty: number;
  note: string;
  inboundId: string;
  createdAt: number;
  updatedAt: number;
};

export type ColorStock = {
  hex: string;
  quantity: number;
  lotCount: number;
  /** 该色最近一次批次变动时间 */
  updatedAt: number;
};

export type InventorySnapshot = {
  items: ColorStock[];
  totalBeads: number;
  colorCount: number;
};

export type InboundLineInput = {
  hex: string;
  quantity: number;
  note?: string;
};

export type InboundDraft = {
  note?: string;
  source: InboundSource;
  lines: InboundLineInput[];
};

export type OutboundLineInput = {
  hex: string;
  quantity: number;
};

export type OutboundDraft = {
  note?: string;
  reason: OutboundReason;
  craftSessionId?: string | null;
  lines: OutboundLineInput[];
};

export type FifoLotSlice = {
  id: string;
  remainingQty: number;
};

export type FifoAllocation = {
  lotId: string;
  quantity: number;
};

export type MovementKind = 'inbound' | 'outbound';

export type InventoryMovement = {
  id: string;
  kind: MovementKind;
  status: DocumentStatus;
  label: string;
  note: string;
  lineCount: number;
  totalQty: number;
  createdAt: number;
  voidedAt: number | null;
};
