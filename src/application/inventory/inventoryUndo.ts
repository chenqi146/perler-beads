import { toastWithAction } from '@/components/ui/ToastProvider';
import { voidInboundDoc, voidOutboundDoc } from '@/application/inventory/inventoryClient';

export type UndoableInventoryDoc = {
  kind: 'inbound' | 'outbound';
  id: string;
  summary: string;
};

let lastUndoable: UndoableInventoryDoc | null = null;

/** 入/出库成功后展示带「撤销」的 toast（45s） */
export function offerInventoryUndo(doc: UndoableInventoryDoc) {
  lastUndoable = doc;
  const label = doc.kind === 'inbound' ? '入库' : '出库';
  toastWithAction({
    message: doc.summary || `已${label}`,
    actionLabel: '撤销',
    durationMs: 45_000,
    onAction: async () => {
      const target = lastUndoable;
      if (!target || target.id !== doc.id) return;
      try {
        if (target.kind === 'inbound') await voidInboundDoc(target.id);
        else await voidOutboundDoc(target.id);
        lastUndoable = null;
        toastWithAction({ message: '已撤销', durationMs: 2200 });
      } catch (err) {
        const msg = err instanceof Error ? err.message : '撤销失败';
        toastWithAction({
          message: `${msg}，可在流水中处理`,
          durationMs: 4000,
        });
      }
    },
  });
}
