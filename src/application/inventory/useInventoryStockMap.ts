'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/utils/apiClient';
import { INVENTORY_LOW_STOCK } from '@/domain/inventory';

export type StockLevel = 'ok' | 'low' | 'none' | 'unknown';

/** 登录用户库存 Map；失败或未登录则为空（静默） */
export function useInventoryStockMap() {
  const [stock, setStock] = useState<Map<string, number>>(new Map());
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await apiFetch('/api/inventory');
      if (!res.ok) {
        setStock(new Map());
        setReady(true);
        return;
      }
      const data = await res.json();
      const map = new Map<string, number>();
      const items = Array.isArray(data.items) ? data.items : [];
      for (const item of items) {
        if (item?.hex) map.set(String(item.hex).toUpperCase(), Number(item.quantity) || 0);
      }
      setStock(map);
    } catch {
      setStock(new Map());
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const getQty = useCallback(
    (hex: string) => stock.get(hex.toUpperCase()) ?? 0,
    [stock],
  );

  const levelFor = useCallback(
    (hex: string, needed?: number): StockLevel => {
      if (!ready) return 'unknown';
      const qty = getQty(hex);
      if (qty <= 0) return 'none';
      if (qty < INVENTORY_LOW_STOCK || (needed != null && qty < needed)) return 'low';
      return 'ok';
    },
    [getQty, ready],
  );

  return { stock, ready, getQty, levelFor, refresh };
}
