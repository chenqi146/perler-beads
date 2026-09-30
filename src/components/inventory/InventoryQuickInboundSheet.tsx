'use client';

import { useState } from 'react';
import Link from 'next/link';
import { getDisplayColorKey, type ColorSystem } from '@/domain/palette';
import { ColorSwatch } from '@/components/ui/ColorSwatch';
import { Overlay } from '@/components/ui/Overlay';
import { useToast } from '@/components/ui/ToastProvider';
import { submitInbound } from '@/application/inventory/inventoryClient';
import { offerInventoryUndo } from '@/application/inventory/inventoryUndo';
import { InventoryColorPicker } from './InventoryColorPicker';

type Props = {
  open: boolean;
  onClose: () => void;
  colorSystem: ColorSystem;
  onSuccess?: () => void;
  initialHex?: string | null;
};

type LineDraft = { key: string; hex: string; quantity: number };

/** 极速入库：可多色加入清单后一次提交 */
export function InventoryQuickInboundSheet({
  open,
  onClose,
  colorSystem,
  onSuccess,
  initialHex = null,
}: Props) {
  const toast = useToast();
  const [hex, setHex] = useState<string | null>(initialHex);
  const [qty, setQty] = useState(100);
  const [lines, setLines] = useState<LineDraft[]>([]);
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const totalQty = lines.reduce((s, l) => s + l.quantity, 0);

  const addCurrentToList = () => {
    if (!hex) {
      toast('请先选择颜色');
      return;
    }
    if (!Number.isInteger(qty) || qty <= 0) {
      toast('数量须为正整数');
      return;
    }
    setLines((prev) => [...prev, { key: crypto.randomUUID(), hex, quantity: qty }]);
    setHex(null);
    toast('已加入清单，可继续选下一种色');
  };

  const submit = async () => {
    const payload =
      lines.length > 0
        ? lines.map((l) => ({ hex: l.hex, quantity: l.quantity }))
        : hex && Number.isInteger(qty) && qty > 0
          ? [{ hex, quantity: qty }]
          : null;

    if (!payload?.length) {
      toast('请选择颜色并设置数量，或先加入清单');
      return;
    }

    setSubmitting(true);
    try {
      const inboundId = await submitInbound({
        source: 'purchase',
        note: payload.length > 1 ? `批量入库 ${payload.length} 色` : '',
        lines: payload,
      });
      const summary =
        payload.length === 1
          ? `已入库 ${payload[0].quantity} 粒 ${getDisplayColorKey(payload[0].hex, colorSystem)}`
          : `已入库 ${payload.length} 色 · ${payload.reduce((s, l) => s + l.quantity, 0).toLocaleString()} 粒`;
      offerInventoryUndo({ kind: 'inbound', id: inboundId, summary });
      setLines([]);
      setHex(null);
      onSuccess?.();
      onClose();
    } catch (err) {
      toast(err instanceof Error ? err.message : '入库失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Overlay
      placement="sheet"
      labelledBy="quick-inbound-title"
      onClose={onClose}
      panelClassName="max-h-[min(88dvh,680px)] border border-[#eadfce]"
    >
      <div className="flex items-center justify-between border-b border-[#eadfce] px-4 py-3">
        <div>
          <h2 id="quick-inbound-title" className="text-sm font-semibold text-[#3a2416]">
            入库
          </h2>
          <p className="text-[11px] text-[#8a6a4a]">
            {lines.length > 0
              ? `清单 ${lines.length} 色 · ${totalQty.toLocaleString()} 粒`
              : '单色直接确认，或多色加入清单'}
          </p>
        </div>
        <button type="button" onClick={onClose} className="text-xs text-[#8a6a4a] underline">
          关闭
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <InventoryColorPicker
          colorSystem={colorSystem}
          value={hex}
          onChange={(h) => setHex(h || null)}
        />

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="number"
            min={1}
            inputMode="numeric"
            value={qty}
            onChange={(e) => setQty(Number(e.target.value))}
            className="h-11 w-28 rounded-xl border border-[#eadfce] bg-[#fffaf3] px-3 text-sm tabular-nums"
            aria-label="数量"
          />
          {[10, 50, 100, 500].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setQty((v) => Math.max(1, v + n))}
              className="h-11 rounded-xl border border-[#eadfce] px-3 text-xs font-medium text-[#5c4030] touch-manipulation"
            >
              +{n}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={addCurrentToList}
          className="h-11 w-full rounded-xl border border-[#c9a882] text-sm font-medium text-[#5c4030] touch-manipulation"
        >
          加入清单（下一种色）
        </button>

        {lines.length > 0 ? (
          <ul className="overflow-hidden rounded-2xl border border-[#eadfce] divide-y divide-[#f0e6d8]">
            {lines.map((line) => (
              <li key={line.key} className="flex items-center gap-2 px-3 py-2.5">
                <ColorSwatch hex={line.hex} size="sm" />
                <span className="min-w-0 flex-1 font-mono text-sm font-medium text-[#3a2416]">
                  {getDisplayColorKey(line.hex, colorSystem)}
                </span>
                <span className="tabular-nums text-sm font-semibold">{line.quantity}</span>
                <button
                  type="button"
                  className="text-xs text-[#8a6a4a] underline"
                  onClick={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}
                >
                  移除
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <button
          type="button"
          disabled={submitting}
          onClick={() => void submit()}
          className="h-12 w-full rounded-xl bg-[#c47a2c] text-sm font-semibold text-white touch-manipulation disabled:opacity-50"
        >
          {submitting
            ? '提交中…'
            : lines.length > 0
              ? `确认入库 · ${lines.length} 色`
              : '确认入库'}
        </button>

        <p className="text-center text-[11px] text-[#8a6a4a]">
          从旧软件导出？
          <Link
            href="/inventory/inbound"
            onClick={onClose}
            className="ml-1 font-medium text-[#c47a2c] underline"
          >
            CSV 导入
          </Link>
        </p>
      </div>
    </Overlay>
  );
}
