import type { InboundSource, OutboundReason } from './types';

export const INBOUND_SOURCE_LABELS: Record<InboundSource, string> = {
  purchase: '购买',
  open_balance: '已有',
  adjust: '补记',
  csv: '批量导入',
};

export const OUTBOUND_REASON_LABELS: Record<OutboundReason, string> = {
  craft: '制作',
  waste: '损耗',
  adjust: '少了',
  other: '其他',
};

export const INBOUND_SOURCES = Object.keys(INBOUND_SOURCE_LABELS) as InboundSource[];
export const OUTBOUND_REASONS = Object.keys(OUTBOUND_REASON_LABELS) as OutboundReason[];
