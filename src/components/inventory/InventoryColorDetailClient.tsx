'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getDisplayColorKey, type ColorSystem } from '@/domain/palette';
import type { BeadLot } from '@/domain/inventory';
import { ColorSwatch } from '@/components/ui/ColorSwatch';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/ToastProvider';
import { fetchInventoryLots } from '@/application/inventory/inventoryClient';
import { formatInventoryTime } from './inventoryUiUtils';
import { useEditorStore } from '@/stores';

type Props = {
  hex: string;
  initialLots: BeadLot[];
};

export function InventoryColorDetailClient({ hex, initialLots }: Props) {
  const toast = useToast();
  const colorSystem = (useEditorStore((s) => s.selectedColorSystem) || 'MARD') as ColorSystem;
  const [lots, setLots] = useState(initialLots);
  const total = lots.reduce((sum, lot) => sum + lot.remainingQty, 0);
  const colorKey = getDisplayColorKey(hex, colorSystem);

  useEffect(() => {
    void fetchInventoryLots(hex, true)
      .then(setLots)
      .catch((err) => toast(err instanceof Error ? err.message : '加载失败'));
  }, [hex, toast]);

  return (
    <main className="platform-page">
      <header className="platform-header">
        <div className="flex min-w-0 items-center gap-3">
          <ColorSwatch hex={hex} size="lg" />
          <div className="min-w-0">
            <p className="eyebrow">BEAD INVENTORY</p>
            <h1 className="font-mono">{colorKey}</h1>
            <p className="mt-1 text-sm text-[#8a6a4a]">
              {hex} · 余量 {total.toLocaleString()} 粒 ·{' '}
              {lots.filter((l) => l.remainingQty > 0).length} 个有效批次
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Link href="/inventory" className="secondary-button">
            返回豆仓
          </Link>
          <Link
            href={`/inventory/outbound?hex=${encodeURIComponent(hex)}`}
            className="secondary-button"
          >
            出库该色
          </Link>
          <Link
            href={`/inventory?quick=1&hex=${encodeURIComponent(hex)}`}
            className="primary-button"
          >
            入库该色
          </Link>
        </div>
      </header>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-[#3a2416]">批次</h2>
        {lots.length === 0 ? (
          <EmptyState
            motif="quiet"
            size="compact"
            kicker="批次"
            title="暂无批次"
            description="入库后，FIFO 批次会出现在这里。"
            action={
              <Link
                href={`/inventory?quick=1&hex=${encodeURIComponent(hex)}`}
                className="primary-button"
              >
                入库该色
              </Link>
            }
          />
        ) : (
          <ul className="overflow-hidden rounded-2xl border border-[#eadfce] bg-[#fffaf3] divide-y divide-[#f0e6d8]">
            {lots.map((lot) => (
              <li key={lot.id} className="px-4 py-3.5">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm font-semibold tabular-nums text-[#3a2416]">
                    {lot.remainingQty.toLocaleString()}
                    <span className="font-normal text-[#8a6a4a]">
                      {' '}
                      / {lot.originalQty.toLocaleString()} 粒
                    </span>
                  </p>
                  <p className="text-[11px] text-[#8a6a4a]">{formatInventoryTime(lot.createdAt)}</p>
                </div>
                {lot.note ? <p className="mt-1 text-xs text-[#5c4030]">{lot.note}</p> : null}
                <p className="mt-1 truncate text-[10px] text-[#b09a80]">批次 {lot.id.slice(0, 8)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
