'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { colorSystemOptions, type ColorSystem } from '@/domain/palette';
import { useToast } from '@/components/ui/ToastProvider';
import { submitInboundCsv } from '@/application/inventory/inventoryClient';
import { offerInventoryUndo } from '@/application/inventory/inventoryUndo';
import { useEditorStore } from '@/stores';

/** CSV 导入入库（手动多色走豆仓首页「入库」） */
export function InventoryInboundClient() {
  const router = useRouter();
  const toast = useToast();
  const storeSystem = useEditorStore((s) => s.selectedColorSystem) as ColorSystem;
  const [colorSystem, setColorSystem] = useState<ColorSystem>(storeSystem || 'MARD');
  const [note, setNote] = useState('');
  const [csvText, setCsvText] = useState('');
  const [csvFileName, setCsvFileName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const csvFileRef = useRef<HTMLInputElement>(null);

  const onCsvFile = (file: File | null) => {
    if (!file) return;
    const lower = file.name.toLowerCase();
    if (
      !lower.endsWith('.csv') &&
      !lower.endsWith('.txt') &&
      file.type &&
      !file.type.includes('csv') &&
      !file.type.includes('text')
    ) {
      toast('请选择 CSV 或文本文件');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || '');
      if (!text.trim()) {
        toast('文件是空的');
        return;
      }
      setCsvText(text);
      setCsvFileName(file.name);
      toast(`已读取 ${file.name}`);
    };
    reader.onerror = () => toast('读取文件失败');
    reader.readAsText(file, 'UTF-8');
  };

  const submitCsv = async () => {
    if (!csvText.trim()) {
      toast('请先上传或粘贴 CSV');
      return;
    }
    setSubmitting(true);
    try {
      const result = await submitInboundCsv(csvText, colorSystem, note || 'CSV 导入');
      offerInventoryUndo({
        kind: 'inbound',
        id: result.inboundId,
        summary: `CSV 已导入 ${result.imported} 行`,
      });
      if (result.parseWarnings?.length) {
        toast(`有 ${result.parseWarnings.length} 行警告`);
      }
      router.push('/inventory');
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'CSV 入库失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="platform-page">
      <header className="platform-header">
        <div>
          <p className="eyebrow">BEAD INVENTORY</p>
          <h1>CSV 导入</h1>
          <p className="mt-1 text-sm text-[#8a6a4a]">
            从文件导入库存；平时记几色请回豆仓点「入库」
          </p>
        </div>
        <Link href="/inventory" className="secondary-button">
          返回豆仓
        </Link>
      </header>

      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 pb-10">
      <label className="block space-y-1">
        <span className="text-xs text-[#8a6a4a]">备注（可选）</span>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="h-11 w-full rounded-xl border border-[#eadfce] bg-[#fffaf3] px-3 text-sm"
          placeholder="例如：从旧软件迁入"
        />
      </label>

      <label className="block space-y-1">
        <span className="text-xs text-[#8a6a4a]">色号体系（编号列解析用）</span>
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

      <div className="rounded-2xl border border-dashed border-[#eadfce] bg-[#fffaf3] p-4">
        <input
          ref={csvFileRef}
          type="file"
          accept=".csv,text/csv,text/plain,.txt"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0] ?? null;
            onCsvFile(file);
            e.target.value = '';
          }}
        />
        <button
          type="button"
          onClick={() => csvFileRef.current?.click()}
          className="primary-button w-full"
        >
          上传 CSV 文件
        </button>
        {csvFileName ? (
          <p className="mt-2 truncate text-center text-xs text-[#5c4030]">
            已选：{csvFileName}
            <button
              type="button"
              className="ml-2 text-[#8a6a4a] underline"
              onClick={() => {
                setCsvFileName('');
                setCsvText('');
              }}
            >
              清除
            </button>
          </p>
        ) : (
          <p className="mt-2 text-center text-[11px] text-[#8a6a4a]">
            支持：品牌,编号,数量,颜色,状态,添加时间
          </p>
        )}
      </div>

      <label className="block space-y-1">
        <span className="text-xs text-[#8a6a4a]">或粘贴 CSV 内容</span>
        <textarea
          value={csvText}
          onChange={(e) => {
            setCsvText(e.target.value);
            if (csvFileName) setCsvFileName('');
          }}
          rows={8}
          placeholder={'品牌,编号,数量,颜色,状态,添加时间\nMARD,A01,4945,#FAF4C8,启用,'}
          className="w-full rounded-xl border border-[#eadfce] bg-[#fffaf3] p-3 font-mono text-xs"
        />
      </label>
      <p className="text-xs text-[#8a6a4a]">导入会追加新批次，不会覆盖已有库存。</p>
      <button
        type="button"
        disabled={submitting || !csvText.trim()}
        onClick={() => void submitCsv()}
        className="primary-button disabled:opacity-50"
      >
        {submitting ? '导入中…' : '确认导入'}
      </button>
      </div>
    </main>
  );
}
