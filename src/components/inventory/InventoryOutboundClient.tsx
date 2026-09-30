'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  OUTBOUND_REASON_LABELS,
  buildOutboundLinesFromGrid,
  type OutboundReason,
} from '@/domain/inventory';
import { getDisplayColorKey, type ColorSystem } from '@/domain/palette';
import { ColorSwatch } from '@/components/ui/ColorSwatch';
import { Overlay } from '@/components/ui/Overlay';
import { useToast } from '@/components/ui/ToastProvider';
import {
  InventoryApiError,
  previewOutbound,
  submitOutbound,
} from '@/application/inventory/inventoryClient';
import { offerInventoryUndo } from '@/application/inventory/inventoryUndo';
import { InventoryColorPicker } from './InventoryColorPicker';
import { useEditorStore } from '@/stores';
import { normalizeInventoryHex } from '@/domain/inventory/hex';
import { listPatterns } from '@/utils/platformStore';
import type { Pattern } from '@/types/platform';

type LineDraft = { key: string; hex: string; quantity: number };

const REASONS = ['craft', 'waste', 'other'] as OutboundReason[];

export function InventoryOutboundClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const colorSystem = (useEditorStore((s) => s.selectedColorSystem) || 'MARD') as ColorSystem;
  const [reason, setReason] = useState<OutboundReason>('craft');
  const [note, setNote] = useState('');
  const [pickerHex, setPickerHex] = useState<string | null>(null);
  const [qty, setQty] = useState(50);
  const [lines, setLines] = useState<LineDraft[]>(() => {
    const preset = searchParams.get('hex');
    const hex = preset ? normalizeInventoryHex(preset) : null;
    return hex ? [{ key: crypto.randomUUID(), hex, quantity: 50 }] : [];
  });
  const [preview, setPreview] = useState<
    Record<string, { lotId: string; quantity: number; remainingAfter: number }[]> | null
  >(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [shortfallHexes, setShortfallHexes] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [patternPickerOpen, setPatternPickerOpen] = useState(false);
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [patternLabel, setPatternLabel] = useState<string | null>(null);

  useEffect(() => {
    setPatterns(listPatterns());
  }, []);

  const totalQty = useMemo(() => lines.reduce((s, l) => s + l.quantity, 0), [lines]);

  const addLine = () => {
    if (!pickerHex) {
      toast('请先选择颜色');
      return;
    }
    if (!Number.isInteger(qty) || qty <= 0) {
      toast('数量须为正整数');
      return;
    }
    setLines((prev) => [...prev, { key: crypto.randomUUID(), hex: pickerHex, quantity: qty }]);
    setPickerHex(null);
    setPreview(null);
    setShortfallHexes([]);
  };

  const loadFromPattern = (pattern: Pattern) => {
    const built = buildOutboundLinesFromGrid(pattern.data?.mappedPixelData);
    if (!built.length) {
      toast('该图纸没有可扣减的像素');
      return;
    }
    setLines(built.map((l) => ({ key: crypto.randomUUID(), hex: l.hex, quantity: l.quantity })));
    setReason('craft');
    setNote(`图纸《${pattern.name}》`);
    setPatternLabel(pattern.name);
    setPatternPickerOpen(false);
    setPreview(null);
    setShortfallHexes([]);
    toast(`已带入 ${built.length} 色`);
  };

  const runPreview = async () => {
    if (!lines.length) {
      toast('请至少添加一行');
      return;
    }
    setSubmitting(true);
    try {
      const data = await previewOutbound(lines.map((l) => ({ hex: l.hex, quantity: l.quantity })));
      setPreview(data.preview);
      setPreviewOpen(true);
      setShortfallHexes([]);
      toast('FIFO 预览已更新');
    } catch (err) {
      setPreview(null);
      if (err instanceof InventoryApiError && err.shortfallHexes?.length) {
        setShortfallHexes(err.shortfallHexes);
        setPreviewOpen(true);
      }
      toast(err instanceof Error ? err.message : '预览失败');
    } finally {
      setSubmitting(false);
    }
  };

  const dropShortfalls = () => {
    if (!shortfallHexes.length) return;
    const drop = new Set(shortfallHexes.map((h) => h.toUpperCase()));
    setLines((prev) => prev.filter((l) => !drop.has(l.hex.toUpperCase())));
    setShortfallHexes([]);
    setPreview(null);
    toast('已去掉缺色，可再次出库');
  };

  const submit = async () => {
    if (!lines.length) {
      toast('请至少添加一行');
      return;
    }
    setSubmitting(true);
    try {
      const result = await submitOutbound({
        reason,
        note,
        lines: lines.map((l) => ({ hex: l.hex, quantity: l.quantity })),
      });
      offerInventoryUndo({
        kind: 'outbound',
        id: result.outboundId,
        summary: result.idempotent
          ? '该制作会话已扣过库存'
          : `已出库 ${totalQty.toLocaleString()} 粒`,
      });
      router.push('/inventory');
      router.refresh();
    } catch (err) {
      if (err instanceof InventoryApiError && err.status === 409) {
        const list = err.shortfallHexes?.length
          ? err.shortfallHexes
          : err.shortfallHex
            ? [err.shortfallHex]
            : [];
        setShortfallHexes(list);
        setPreviewOpen(true);
      }
      toast(err instanceof Error ? err.message : '出库失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="platform-page">
      <header className="platform-header">
        <div>
          <p className="eyebrow">BEAD INVENTORY</p>
          <h1>新建出库单</h1>
          <p className="mt-1 text-sm text-[#8a6a4a]">按 FIFO 从最早批次扣减；库存不足则整单失败</p>
        </div>
        <Link href="/inventory" className="secondary-button">
          返回豆仓
        </Link>
      </header>

      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 pb-10">
      <button
        type="button"
        onClick={() => setPatternPickerOpen(true)}
        className="secondary-button w-full"
      >
        从图纸带入{patternLabel ? ` · 当前《${patternLabel}》` : ''}
      </button>

      <div className="space-y-1.5">
        <span className="text-xs text-[#8a6a4a]">这次是</span>
        <div className="flex gap-1 rounded-xl bg-[#efe6d8]/80 p-0.5" role="radiogroup" aria-label="出库原因">
          {REASONS.map((r) => (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={reason === r}
              onClick={() => setReason(r)}
              className={`h-10 flex-1 rounded-lg text-xs font-medium touch-manipulation ${
                reason === r ? 'bg-[#fffaf3] text-[#3a2416] shadow-sm' : 'text-[#8a6a4a]'
              }`}
            >
              {OUTBOUND_REASON_LABELS[r]}
            </button>
          ))}
        </div>
      </div>

      <label className="block space-y-1">
        <span className="text-xs text-[#8a6a4a]">备注</span>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="h-11 w-full rounded-xl border border-[#eadfce] bg-[#fffaf3] px-3 text-sm"
          placeholder="例如：作品《小猫》消耗"
        />
      </label>

      <div className="rounded-2xl border border-[#eadfce] bg-[#fffaf3] p-3 space-y-3">
        <p className="text-sm font-medium text-[#3a2416]">添加明细</p>
        <InventoryColorPicker
          colorSystem={colorSystem}
          value={pickerHex}
          onChange={(hex) => setPickerHex(hex || null)}
        />
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="number"
            min={1}
            value={qty}
            onChange={(e) => setQty(Number(e.target.value))}
            className="h-11 w-28 rounded-xl border border-[#eadfce] bg-white px-3 text-sm tabular-nums"
          />
          {[10, 50, 100].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setQty((v) => v + n)}
              className="h-11 rounded-xl border border-[#eadfce] px-3 text-xs font-medium text-[#5c4030]"
            >
              +{n}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={addLine}
          className="h-11 w-full rounded-xl border border-[#c9a882] text-sm font-medium text-[#5c4030]"
        >
          加入清单
        </button>
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-[#3a2416]">
          明细 · {lines.length} 行 · {totalQty.toLocaleString()} 粒
        </h2>
        {lines.length === 0 ? (
          <p className="text-sm text-[#8a6a4a]">还没有明细</p>
        ) : (
          <ul className="overflow-hidden rounded-2xl border border-[#eadfce] divide-y divide-[#f0e6d8] bg-[#fffaf3]">
            {lines.map((line) => {
              const short = shortfallHexes.some(
                (h) => h.toUpperCase() === line.hex.toUpperCase(),
              );
              return (
                <li
                  key={line.key}
                  className={`flex items-center gap-2 px-3 py-2.5 ${short ? 'bg-[#fff4e6]' : ''}`}
                >
                  <ColorSwatch hex={line.hex} size="sm" />
                  <span className="min-w-0 flex-1 font-mono text-sm font-medium">
                    {getDisplayColorKey(line.hex, colorSystem)}
                    {short ? <span className="ml-1 text-[10px] text-[#c47a2c]">缺</span> : null}
                  </span>
                  <span className="tabular-nums text-sm font-semibold">{line.quantity}</span>
                  <button
                    type="button"
                    className="text-xs text-[#8a6a4a] underline"
                    onClick={() => {
                      setLines((prev) => prev.filter((l) => l.key !== line.key));
                      setPreview(null);
                    }}
                  >
                    移除
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {shortfallHexes.length > 0 ? (
        <div className="rounded-2xl border border-[#e8b86a] bg-[#fff4e6] p-3">
          <p className="text-sm font-medium text-[#3a2416]">
            库存不足 {shortfallHexes.length} 色
          </p>
          <button
            type="button"
            onClick={dropShortfalls}
            className="mt-2 h-10 w-full rounded-xl border border-[#c9a882] text-xs font-medium text-[#5c4030]"
          >
            去掉缺色再出库
          </button>
        </div>
      ) : null}

      {preview && previewOpen ? (
        <section className="rounded-2xl border border-[#eadfce] bg-[#fff4e6] p-3">
          <button
            type="button"
            className="flex w-full items-center justify-between text-sm font-semibold text-[#3a2416]"
            onClick={() => setPreviewOpen((v) => !v)}
          >
            FIFO 扣减预览
            <span className="text-xs font-normal text-[#8a6a4a]">收起</span>
          </button>
          <ul className="mt-2 space-y-2 text-xs text-[#5c4030]">
            {Object.entries(preview).map(([hex, allocs]) => (
              <li key={hex}>
                <p className="font-mono font-medium">{getDisplayColorKey(hex, colorSystem)}</p>
                {allocs.map((a) => (
                  <p key={a.lotId} className="pl-2 text-[#8a6a4a]">
                    批次 {a.lotId.slice(0, 8)} −{a.quantity} → 剩 {a.remainingAfter}
                  </p>
                ))}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          disabled={submitting}
          onClick={() => void runPreview()}
          className="secondary-button flex-1 disabled:opacity-50"
        >
          预览 FIFO
        </button>
        <button
          type="button"
          disabled={submitting}
          onClick={() => void submit()}
          className="primary-button flex-1 disabled:opacity-50"
        >
          {submitting ? '提交中…' : '确认出库'}
        </button>
      </div>

      {patternPickerOpen ? (
        <Overlay
          placement="sheet"
          labelledBy="pattern-pick-title"
          onClose={() => setPatternPickerOpen(false)}
          panelClassName="max-h-[min(70dvh,520px)] border border-[#eadfce]"
        >
          <div className="border-b border-[#eadfce] px-4 py-3">
            <h2 id="pattern-pick-title" className="text-sm font-semibold text-[#3a2416]">
              选择图纸
            </h2>
          </div>
          <ul className="max-h-[50dvh] overflow-y-auto divide-y divide-[#f0e6d8]">
            {patterns.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-[#8a6a4a]">本地暂无图纸</li>
            ) : (
              patterns.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    className="flex w-full flex-col items-start gap-0.5 px-4 py-3 text-left hover:bg-[#fff4e6]"
                    onClick={() => loadFromPattern(p)}
                  >
                    <span className="text-sm font-medium text-[#3a2416]">{p.name}</span>
                    <span className="text-[11px] text-[#8a6a4a]">
                      {(p.data?.mappedPixelData?.length || 0) > 0
                        ? `${p.data.gridDimensions?.N || '?'}×${p.data.gridDimensions?.M || '?'}`
                        : '空图纸'}
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </Overlay>
      ) : null}
      </div>
    </main>
  );
}
