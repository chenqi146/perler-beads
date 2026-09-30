'use client';

import { IngredientBill, exportIngredientCsv } from '../utils/ingredientEngine';
import { ColorSwatch } from './ui/ColorSwatch';
import { CloseIcon, IconButton } from './ui/IconButton';
import { Overlay } from './ui/Overlay';
import { useInventoryStockMap } from '@/application/inventory/useInventoryStockMap';

interface IngredientBillModalProps {
  bill: IngredientBill;
  onClose: () => void;
}

export default function IngredientBillModal({ bill, onClose }: IngredientBillModalProps) {
  const totalWeight = bill.items.reduce((sum, item) => sum + item.estimatedWeight, 0);
  const { getQty, ready } = useInventoryStockMap();

  const rows = bill.items.map((item) => {
    const stock = getQty(item.hexCode);
    const gap = Math.max(0, item.beadCount - stock);
    const buySuggest = Math.max(0, item.suggestedCount - stock);
    return { ...item, stock, gap, buySuggest };
  });

  const totalGap = rows.reduce((s, r) => s + r.gap, 0);

  return (
    <Overlay labelledBy="ingredient-bill-title" onClose={onClose} panelClassName="max-h-[85vh] max-w-2xl">
      <header className="flex items-start justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-800">
        <div>
          <h2 id="ingredient-bill-title" className="text-base font-semibold text-gray-900 dark:text-white">
            采购清单
          </h2>
          <p className="mt-1 text-xs text-gray-500">
            {bill.gridSize.cols} × {bill.gridSize.rows} · {bill.totalBeads.toLocaleString()} 粒 ·{' '}
            {bill.colorCount} 色
            {ready && totalGap > 0 ? ` · 缺口 ${totalGap.toLocaleString()} 粒` : ''}
          </p>
        </div>
        <IconButton aria-label="关闭" onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </header>
      <div className="grid grid-cols-3 gap-2 border-b border-gray-100 px-5 py-3 text-center dark:border-gray-800">
        <div>
          <strong className="block text-sm text-gray-900 dark:text-white">
            {bill.totalBeads.toLocaleString()}
          </strong>
          <span className="text-[11px] text-gray-500">图纸用量</span>
        </div>
        <div>
          <strong className="block text-sm text-gray-900 dark:text-white">
            {Math.ceil(bill.totalBeads * bill.wasteRatio).toLocaleString()}
          </strong>
          <span className="text-[11px] text-gray-500">建议购买(毛)</span>
        </div>
        <div>
          <strong className="block text-sm text-gray-900 dark:text-white">{totalWeight.toFixed(2)}g</strong>
          <span className="text-[11px] text-gray-500">理论重量</span>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 bg-white text-gray-500 dark:bg-gray-900">
            <tr>
              <th className="py-2">色号</th>
              <th>颜色</th>
              <th className="text-right">用量</th>
              <th className="text-right">库存</th>
              <th className="text-right">缺口</th>
              <th className="text-right">建议购</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((item) => (
              <tr
                key={item.hexCode}
                className={`border-t border-gray-100 dark:border-gray-800 ${
                  item.gap > 0 ? 'bg-[#fff8f0]' : ''
                }`}
              >
                <td className="py-2 font-mono font-medium">{item.colorKey}</td>
                <td>
                  <ColorSwatch hex={item.hexCode} className="mr-2 h-3.5 w-3.5 align-middle" />
                  {item.hexCode}
                </td>
                <td className="text-right">{item.beadCount}</td>
                <td className="text-right">{ready ? item.stock : '—'}</td>
                <td className={`text-right ${item.gap > 0 ? 'font-semibold text-[#c47a2c]' : ''}`}>
                  {ready ? item.gap : '—'}
                </td>
                <td className="text-right">{ready ? item.buySuggest : item.suggestedCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <footer className="flex justify-end gap-2 border-t border-gray-200 px-5 py-3 dark:border-gray-800">
        <button
          type="button"
          onClick={() => exportIngredientCsv(bill)}
          className="h-9 rounded-md border border-gray-300 px-3 text-xs font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-gray-700 dark:text-gray-200"
        >
          导出 CSV
        </button>
        <button
          type="button"
          onClick={onClose}
          className="h-9 rounded-md bg-[#c47a2c] px-4 text-xs font-medium text-white hover:bg-[#b56c22] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e8b86a]"
        >
          完成
        </button>
      </footer>
    </Overlay>
  );
}
