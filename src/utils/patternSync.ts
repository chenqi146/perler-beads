import type { Pattern } from '../domain/pattern';
import { getPattern, writePlatformStore } from './platformStore';
import { apiFetch } from './apiClient';
import { toast } from '@/components/ui/ToastProvider';

export type SyncResult =
  | { ok: true; patterns?: Pattern[]; pattern?: Pattern }
  | { ok: false; status: number; message: string };

const KEY = 'perler-platform-v1';

function readStore(): { patterns: Pattern[]; sessions: unknown[]; works: unknown[] } {
  if (typeof window === 'undefined') return { patterns: [], sessions: [], works: [] };
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return {
      patterns: Array.isArray(parsed.patterns) ? (parsed.patterns as Pattern[]) : [],
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      works: Array.isArray(parsed.works) ? parsed.works : [],
    };
  } catch {
    return { patterns: [], sessions: [], works: [] };
  }
}

function writeStore(store: { patterns: Pattern[]; sessions: unknown[]; works: unknown[] }) {
  writePlatformStore(store as Parameters<typeof writePlatformStore>[0]);
}

function mergeRemotePattern(remote: Pattern) {
  const store = readStore();
  // 云端原图也别塞进本地，防止再次撑爆配额
  const slimRemote: Pattern = {
    ...remote,
    data: { ...remote.data, originalImageSrc: null },
  };
  const idx = store.patterns.findIndex((p) => p.id === remote.id);
  if (idx < 0) {
    store.patterns.unshift(slimRemote);
    writeStore(store);
    return;
  }
  const local = store.patterns[idx];
  if ((remote.updatedAt || 0) >= (local.updatedAt || 0)) {
    store.patterns[idx] = slimRemote;
    writeStore(store);
  }
}

export async function pullPatternsFromCloud(): Promise<SyncResult> {
  try {
    const res = await apiFetch('/api/patterns');
    if (res.status === 503) {
      toast('云端未就绪，仅本地');
      return { ok: false, status: 503, message: '云端未就绪，仅本地' };
    }
    if (res.status === 401) {
      return { ok: false, status: 401, message: '未登录' };
    }
    if (!res.ok) {
      toast('拉取图纸失败');
      return { ok: false, status: res.status, message: '拉取失败' };
    }
    const data = await res.json();
    const remote = Array.isArray(data.patterns) ? (data.patterns as Pattern[]) : [];
    for (const pattern of remote) {
      mergeRemotePattern(pattern);
    }
    return { ok: true, patterns: remote };
  } catch {
    toast('网络异常');
    return { ok: false, status: 0, message: '网络异常' };
  }
}

export async function pushPatternToCloud(pattern: Pattern): Promise<SyncResult> {
  try {
    // 优先用调用方传入的完整对象（可含原图）；本地 get 可能已剥掉原图
    const local = getPattern(pattern.id);
    const latest: Pattern =
      local && (local.updatedAt || 0) > (pattern.updatedAt || 0)
        ? {
            ...local,
            data: {
              ...local.data,
              originalImageSrc: local.data.originalImageSrc || pattern.data.originalImageSrc,
            },
          }
        : pattern;

    // 云端也不存超大 dataURL，避免 D1 行过大；格子数据足够
    const forCloud: Pattern = {
      ...latest,
      data: {
        ...latest.data,
        originalImageSrc:
          typeof latest.data.originalImageSrc === 'string' &&
          latest.data.originalImageSrc.length > 400_000
            ? null
            : latest.data.originalImageSrc,
      },
    };

    const res = await apiFetch('/api/patterns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(forCloud),
    });
    if (res.status === 503) {
      toast('云端未就绪，已仅本地保存');
      return { ok: false, status: 503, message: '云端未就绪，已仅本地保存' };
    }
    if (res.status === 401) {
      return { ok: false, status: 401, message: '未登录' };
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const message = typeof data.error === 'string' ? data.error : '同步失败';
      toast(message);
      return { ok: false, status: res.status, message };
    }
    const data = await res.json();
    return { ok: true, pattern: data.pattern as Pattern };
  } catch {
    toast('网络异常');
    return { ok: false, status: 0, message: '网络异常' };
  }
}
