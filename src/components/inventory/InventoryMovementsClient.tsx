'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { InventoryMovement } from '@/domain/inventory';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/ToastProvider';
import { useConfirm } from '@/components/ui/confirm-dialog';
import {
  fetchInventoryMovements,
  voidInboundDoc,
  voidOutboundDoc,
} from '@/application/inventory/inventoryClient';
import { formatInventoryTime } from './inventoryUiUtils';

type Props = {
  initial: InventoryMovement[];
};

export function InventoryMovementsClient({ initial }: Props) {
  const toast = useToast();
  const confirm = useConfirm();
  const [movements, setMovements] = useState(initial);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = async () => {
    try {
      setMovements(await fetchInventoryMovements());
    } catch (err) {
      toast(err instanceof Error ? err.message : '加载失败');
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const voidDoc = async (m: InventoryMovement) => {
    if (m.status === 'voided') return;
    const ok = await confirm({
      title: m.kind === 'inbound' ? '作废入库单？' : '作废出库单？',
      description:
        m.kind === 'inbound'
          ? '仅当批次未被出库消耗时可以作废，并删除对应批次。'
          : '将按分配记录把数量加回各批次。',
      confirmLabel: '作废',
    });
    if (!ok) return;
    setBusyId(m.id);
    try {
      if (m.kind === 'inbound') await voidInboundDoc(m.id);
      else await voidOutboundDoc(m.id);
      toast('已作废');
      await refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : '作废失败');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <main className="platform-page">
      <header className="platform-header">
        <div>
          <p className="eyebrow">BEAD INVENTORY</p>
          <h1>入出库流水</h1>
          <p className="mt-1 text-sm text-[#8a6a4a]">最近单据；可作废未消耗的入库或任意出库</p>
        </div>
        <Link href="/inventory" className="secondary-button">
          返回豆仓
        </Link>
      </header>

      {movements.length === 0 ? (
        <EmptyState
          motif="quiet"
          kicker="流水"
          title="暂无流水"
          description="入库或出库之后，单据会出现在这里。"
          action={
            <Link href="/inventory" className="primary-button">
              去豆仓
            </Link>
          }
        />
      ) : (
        <ul className="overflow-hidden rounded-2xl border border-[#eadfce] bg-[#fffaf3] divide-y divide-[#f0e6d8]">
          {movements.map((m) => (
            <li key={`${m.kind}-${m.id}`} className="px-4 py-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#3a2416]">
                    <span
                      className={
                        m.kind === 'inbound' ? 'text-[#c47a2c]' : 'text-[#5c4030]'
                      }
                    >
                      {m.kind === 'inbound' ? '入库' : '出库'}
                    </span>
                    {' · '}
                    {m.label}
                    {m.status === 'voided' ? (
                      <span className="ml-2 text-xs font-normal text-[#b09a80]">已作废</span>
                    ) : null}
                  </p>
                  <p className="mt-0.5 text-xs text-[#8a6a4a]">
                    {m.lineCount} 行 · {m.totalQty.toLocaleString()} 粒 ·{' '}
                    {formatInventoryTime(m.createdAt)}
                  </p>
                  {m.note ? <p className="mt-1 text-xs text-[#5c4030]">{m.note}</p> : null}
                </div>
                {m.status === 'posted' ? (
                  <button
                    type="button"
                    disabled={busyId === m.id}
                    onClick={() => void voidDoc(m)}
                    className="shrink-0 text-xs text-[#8a6a4a] underline disabled:opacity-50"
                  >
                    作废
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
