import { getDisplayColorKey, type ColorSystem } from '@/domain/palette';

export function groupHexByPrefix<T extends { hex: string }>(
  items: T[],
  colorSystem: ColorSystem,
): { prefix: string; items: T[] }[] {
  const groups: Record<string, T[]> = {};

  for (const item of items) {
    const displayKey = getDisplayColorKey(item.hex, colorSystem);
    let prefix: string;
    if (colorSystem === '盼盼' || colorSystem === '咪小窝') {
      if (/^\d+$/.test(displayKey)) {
        const num = parseInt(displayKey, 10);
        if (num <= 20) prefix = '1-20';
        else if (num <= 50) prefix = '21-50';
        else if (num <= 100) prefix = '51-100';
        else if (num <= 200) prefix = '101-200';
        else prefix = '200+';
      } else {
        prefix = '其他';
      }
    } else {
      prefix = displayKey.match(/^[A-Z]+/)?.[0] || '其他';
    }
    if (!groups[prefix]) groups[prefix] = [];
    groups[prefix].push(item);
  }

  return Object.keys(groups)
    .sort((a, b) => a.localeCompare(b, 'zh'))
    .map((prefix) => ({
      prefix,
      items: groups[prefix].sort((a, b) => {
        const ka = getDisplayColorKey(a.hex, colorSystem);
        const kb = getDisplayColorKey(b.hex, colorSystem);
        return ka.localeCompare(kb, 'zh', { numeric: true });
      }),
    }));
}

export function formatInventoryTime(ts: number): string {
  try {
    return new Date(ts).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(ts);
  }
}
