'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  getDisplayColorKey,
  colorSystemOptions,
  type ColorSystem,
} from '@/domain/palette';
import {
  exportStockCsv,
  INVENTORY_LOW_STOCK,
  INVENTORY_RECENT_MS,
  hexToPathParam,
  normalizeInventoryHex,
} from '@/domain/inventory';
import type { ColorStock, InventorySnapshot } from '@/domain/inventory';
import { ColorSwatch } from '@/components/ui/ColorSwatch';
import { EmptyState } from '@/components/ui/EmptyState';
import { Overlay } from '@/components/ui/Overlay';
import { Switch } from '@/components/ui/Switch';
import { useToast } from '@/components/ui/ToastProvider';
import { fetchInventoryStock } from '@/application/inventory/inventoryClient';
import { groupHexByPrefix } from './inventoryUiUtils';
import { InventoryQuickInboundSheet } from './InventoryQuickInboundSheet';
import { useEditorStore } from '@/stores';

type Props = {
  initial: InventorySnapshot;
  cloudAvailable: boolean;
};

type StockTab = 'low' | 'recent' | 'all';

function MoreIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden>
      <circle cx="5" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="19" cy="12" r="1.6" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5" aria-hidden>
      <circle cx="11" cy="11" r="6.5" />
      <path strokeLinecap="round" d="M16.5 16.5L20 20" />
    </svg>
  );
}

export function InventoryOverviewClient({ initial, cloudAvailable }: Props) {
  const toast = useToast();
  const searchParams = useSearchParams();
  const storeSystem = useEditorStore((s) => s.selectedColorSystem) as ColorSystem;
  const [colorSystem, setColorSystem] = useState<ColorSystem>(storeSystem || 'MARD');
  const [snapshot, setSnapshot] = useState(initial);
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [includeEmpty, setIncludeEmpty] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<StockTab>('all');
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickHex, setQuickHex] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    if (searchParams.get('quick') === '1') {
      const hex = normalizeInventoryHex(searchParams.get('hex') || '');
      setQuickHex(hex);
      setQuickOpen(true);
    }
  }, [searchParams]);

  const refresh = async (empty = includeEmpty) => {
    setLoading(true);
    try {
      const data = await fetchInventoryStock(empty);
      setSnapshot(data);
    } catch (err) {
      toast(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  };

  const lowCount = useMemo(
    () => snapshot.items.filter((i) => i.quantity > 0 && i.quantity < INVENTORY_LOW_STOCK).length,
    [snapshot.items],
  );

  const tabItems = useMemo(() => {
    const now = Date.now();
    if (tab === 'low') {
      return snapshot.items.filter((i) => i.quantity > 0 && i.quantity < INVENTORY_LOW_STOCK);
    }
    if (tab === 'recent') {
      return snapshot.items.filter(
        (i) => i.updatedAt && now - i.updatedAt <= INVENTORY_RECENT_MS,
      );
    }
    return snapshot.items;
  }, [snapshot.items, tab]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tabItems;
    return tabItems.filter((item) => {
      const key = getDisplayColorKey(item.hex, colorSystem).toLowerCase();
      return key.includes(q) || item.hex.toLowerCase().includes(q);
    });
  }, [tabItems, query, colorSystem]);

  const groups = useMemo(
    () => groupHexByPrefix(filtered, colorSystem),
    [filtered, colorSystem],
  );

  const exportCsv = () => {
    const rows = snapshot.items.map((item) => ({
      colorKey: getDisplayColorKey(item.hex, colorSystem),
      hex: item.hex,
      quantity: item.quantity,
      lotCount: item.lotCount,
    }));
    const csv = `\uFEFF${exportStockCsv(rows)}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bead-inventory.csv';
    a.click();
    URL.revokeObjectURL(url);
    setMoreOpen(false);
    toast('已导出库存 CSV');
  };

  const openQuick = (hex: string | null = null) => {
    setQuickHex(hex);
    setQuickOpen(true);
  };

  const emptyHint =
    tab === 'low'
      ? '没有快见底的颜色'
      : tab === 'recent'
        ? '近 7 天没有变动'
        : '豆仓还是空的';

  return (
    <main className="platform-page pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:pb-10">
      <header className="platform-header">
        <div>
          <p className="eyebrow">BEAD INVENTORY</p>
          <h1>豆仓</h1>
          <p className="mt-1 text-sm text-[#8a6a4a]">
            <span className="tabular-nums font-medium text-[#5c4030]">
              {snapshot.colorCount}
            </span>{' '}
            色 ·{' '}
            <span className="tabular-nums font-medium text-[#5c4030]">
              {snapshot.totalBeads.toLocaleString()}
            </span>{' '}
            粒
            {!cloudAvailable ? ' · 云端未就绪' : ''}
            {loading ? ' · …' : ''}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            aria-label="搜索色号"
            aria-pressed={searchOpen}
            onClick={() => setSearchOpen((v) => !v)}
            className={`inline-flex h-11 w-11 items-center justify-center rounded-xl touch-manipulation ${
              searchOpen || query
                ? 'bg-[#f3e6d4] text-[#3a2416]'
                : 'border border-[#e0d0bc] bg-white text-[#8a6a4a] hover:bg-[#fff4e6]'
            }`}
          >
            <SearchIcon />
          </button>
          <button
            type="button"
            aria-label="更多"
            onClick={() => setMoreOpen(true)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[#e0d0bc] bg-white text-[#8a6a4a] touch-manipulation hover:bg-[#fff4e6]"
          >
            <MoreIcon />
          </button>
          <Link href="/inventory/outbound" className="secondary-button hidden sm:inline-flex">
            出库
          </Link>
          <button
            type="button"
            onClick={() => openQuick(null)}
            className="primary-button hidden sm:inline-flex"
          >
            入库
          </button>
        </div>
      </header>

      {searchOpen ? (
        <div className="mb-3 flex gap-2">
          <input
            autoFocus
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索色号或 hex"
            className="h-11 flex-1 rounded-xl border border-[#eadfce] bg-[#fffaf3] px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e8b86a]"
          />
          {query ? (
            <button
              type="button"
              className="h-11 shrink-0 px-2 text-xs text-[#8a6a4a]"
              onClick={() => setQuery('')}
            >
              清除
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="mb-4 flex gap-1 rounded-xl border border-[#eadfce] bg-[#fffaf3] p-1">
        {(
          [
            { id: 'low' as const, label: '快见底', badge: lowCount },
            { id: 'recent' as const, label: '最近' },
            { id: 'all' as const, label: '全部' },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`h-10 flex-1 rounded-lg text-sm font-medium touch-manipulation ${
              tab === item.id ? 'bg-[#f3e6d4] text-[#3a2416]' : 'text-[#8a6a4a]'
            }`}
          >
            {item.label}
            {'badge' in item && item.badge > 0 ? (
              <span className="ml-0.5 inline-flex min-w-[1rem] justify-center rounded-full bg-[#c47a2c] px-1 text-[10px] font-semibold text-white">
                {item.badge}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {groups.length === 0 ? (
        tab === 'all' && !query ? (
          <EmptyState
            motif="board"
            kicker="豆仓"
            title="豆仓还是空的"
            description={
              <>
                拆一包豆就记一笔。
                <br />
                很多色可以用「更多」里的 CSV 一次导入。
              </>
            }
            action={
              <button type="button" className="primary-button" onClick={() => openQuick(null)}>
                入库
              </button>
            }
          />
        ) : (
          <EmptyState
            motif="search"
            size="compact"
            kicker={tab === 'low' ? '快见底' : tab === 'recent' ? '最近' : '筛选'}
            title={emptyHint}
            description={
              query
                ? '换个色号或 hex 再试试。'
                : tab === 'all'
                  ? '换个关键词再试试。'
                  : '也可以先看全部库存。'
            }
            action={
              tab !== 'all' ? (
                <button type="button" className="secondary-button" onClick={() => setTab('all')}>
                  查看全部
                </button>
              ) : undefined
            }
          />
        )
      ) : (
        <div className="grid gap-5 lg:grid-cols-2 lg:gap-x-6 lg:gap-y-5">
          {groups.map((group) => (
            <section key={group.prefix}>
              <h2 className="mb-1.5 px-0.5 text-[11px] font-semibold tracking-wide text-[#8a6a4a]">
                {group.prefix}
              </h2>
              <ul className="overflow-hidden rounded-2xl border border-[#eadfce] bg-[#fffaf3] divide-y divide-[#f0e6d8]">
                {(group.items as ColorStock[]).map((item) => (
                  <li key={item.hex}>
                    <Link
                      href={`/inventory/color/${hexToPathParam(item.hex)}`}
                      className="flex min-h-[52px] items-center gap-3 px-3 py-2.5 touch-manipulation active:bg-[#fff4e6]"
                    >
                      <ColorSwatch hex={item.hex} size="md" />
                      <div className="min-w-0 flex-1">
                        <p className="font-mono text-sm font-semibold text-[#3a2416]">
                          {getDisplayColorKey(item.hex, colorSystem)}
                        </p>
                        <p className="text-[11px] text-[#8a6a4a]">
                          {item.lotCount} 批
                          {item.quantity > 0 && item.quantity < INVENTORY_LOW_STOCK
                            ? ' · 快见底'
                            : ''}
                        </p>
                      </div>
                      <p
                        className={`text-sm font-semibold tabular-nums ${
                          item.quantity > 0 && item.quantity < INVENTORY_LOW_STOCK
                            ? 'text-[#c47a2c]'
                            : 'text-[#3a2416]'
                        }`}
                      >
                        {item.quantity.toLocaleString()}
                        <span className="ml-0.5 text-xs font-normal text-[#8a6a4a]">粒</span>
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[#eadfce] bg-[#fffaf3]/95 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-sm sm:hidden">
        <div className="mx-auto flex max-w-lg gap-2">
          <Link
            href="/inventory/outbound"
            className="inline-flex h-12 flex-1 items-center justify-center rounded-2xl border border-[#c9a882] text-sm font-semibold text-[#5c4030] touch-manipulation active:bg-[#f3e6d4]"
          >
            出库
          </Link>
          <button
            type="button"
            onClick={() => openQuick(null)}
            className="inline-flex h-12 flex-[1.35] items-center justify-center rounded-2xl bg-[#c47a2c] text-sm font-semibold text-white touch-manipulation shadow-[0_6px_16px_rgba(196,122,44,0.28)] active:bg-[#b56c22]"
          >
            入库
          </button>
        </div>
      </div>

      {moreOpen ? (
        <Overlay
          placement="sheet"
          labelledBy="inventory-more-title"
          onClose={() => setMoreOpen(false)}
          panelClassName="max-h-[min(70dvh,480px)] border border-[#eadfce]"
        >
          <div className="border-b border-[#eadfce] px-4 py-3">
            <h2 id="inventory-more-title" className="text-sm font-semibold text-[#3a2416]">
              更多
            </h2>
            <p className="mt-0.5 text-[11px] text-[#8a6a4a]">CSV、流水与显示设置</p>
          </div>
          <div className="space-y-1 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <Link
              href="/inventory/inbound"
              onClick={() => setMoreOpen(false)}
              className="flex h-12 items-center rounded-xl px-3 text-sm font-medium text-[#3a2416] hover:bg-[#fff4e6]"
            >
              CSV 导入
            </Link>
            <Link
              href="/inventory/movements"
              onClick={() => setMoreOpen(false)}
              className="flex h-12 items-center rounded-xl px-3 text-sm font-medium text-[#3a2416] hover:bg-[#fff4e6]"
            >
              入出库流水
            </Link>
            <button
              type="button"
              onClick={exportCsv}
              className="flex h-12 w-full items-center rounded-xl px-3 text-left text-sm font-medium text-[#3a2416] hover:bg-[#fff4e6]"
            >
              导出库存 CSV
            </button>
            <div className="my-2 border-t border-[#eadfce]" />
            <label className="block space-y-1 px-3 py-2">
              <span className="text-xs text-[#8a6a4a]">色号体系</span>
              <select
                value={colorSystem}
                onChange={(e) => setColorSystem(e.target.value as ColorSystem)}
                className="h-11 w-full rounded-xl border border-[#eadfce] bg-[#fffaf3] px-3 text-sm"
              >
                {colorSystemOptions.map((opt) => (
                  <option key={opt.key} value={opt.key}>
                    {opt.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="px-3 py-2">
              <Switch
                checked={includeEmpty}
                onChange={(checked) => {
                  setIncludeEmpty(checked);
                  void refresh(checked);
                }}
                label="显示已清空的色"
                description="余量为 0 的色号也列出"
              />
            </div>
          </div>
        </Overlay>
      ) : null}

      <InventoryQuickInboundSheet
        key={quickHex || 'quick'}
        open={quickOpen}
        onClose={() => setQuickOpen(false)}
        colorSystem={colorSystem}
        initialHex={quickHex}
        onSuccess={() => void refresh()}
      />
    </main>
  );
}
