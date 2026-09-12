import type { Pattern } from '../domain/pattern';
import { getPattern } from './platformStore';

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

/** 按 updatedAt merge：云端更新则覆盖本地同 id */
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

/** 拉取云端图纸并按 updatedAt merge 进本地 */
export async function pullPatternsFromCloud(): Promise<SyncResult> {
  try {
    const res = await fetch('/api/patterns', { credentials: 'include' });
    if (res.status === 503 || res.status === 401) {
      return {
        ok: false,
        status: res.status,
        message: res.status === 503 ? '云端未就绪，仅本地' : '未登录云端',
      };
    }
    if (!res.ok) {
      return { ok: false, status: res.status, message: '拉取失败' };
    }
    const data = await res.json();
    const remote = Array.isArray(data.patterns) ? (data.patterns as Pattern[]) : [];
    for (const pattern of remote) {
      mergeRemotePattern(pattern);
    }
    return { ok: true, patterns: remote };
  } catch {
    return { ok: false, status: 0, message: '网络异常' };
  }
}

/** 保存后推送到云端（失败不阻断本地） */
export async function pushPatternToCloud(pattern: Pattern): Promise<SyncResult> {
  try {
    // 确保带上最新本地记录
    const latest = getPattern(pattern.id) ?? pattern;
    const res = await fetch('/api/patterns', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(latest),
    });
    if (res.status === 503 || res.status === 401) {
      return {
        ok: false,
        status: res.status,
        message: res.status === 503 ? '云端未就绪，已仅本地保存' : '未登录云端',
      };
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return {
        ok: false,
        status: res.status,
        message: typeof data.error === 'string' ? data.error : '同步失败',
      };
    }
    const data = await res.json();
    return { ok: true, pattern: data.pattern as Pattern };
  } catch {
    return { ok: false, status: 0, message: '网络异常' };
  }
}
