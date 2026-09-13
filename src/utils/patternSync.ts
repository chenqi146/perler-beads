import type { Pattern } from '../domain/pattern';
import { getPattern } from './platformStore';
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
      patterns: Array.isArray(parsed.patterns) ? parsed.patterns : [],
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      works: Array.isArray(parsed.works) ? parsed.works : [],
    };
  } catch {
    return { patterns: [], sessions: [], works: [] };
  }
}

function writeStore(store: { patterns: Pattern[]; sessions: unknown[]; works: unknown[] }) {
  localStorage.setItem(KEY, JSON.stringify(store));
}

function mergeRemotePattern(remote: Pattern) {
  const store = readStore();
  const idx = store.patterns.findIndex((p) => p.id === remote.id);
  if (idx < 0) {
    store.patterns.unshift(remote);
    writeStore(store);
    return;
  }
  const local = store.patterns[idx];
  if ((remote.updatedAt || 0) >= (local.updatedAt || 0)) {
    store.patterns[idx] = remote;
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
    const latest = getPattern(pattern.id) ?? pattern;
    const res = await apiFetch('/api/patterns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(latest),
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
