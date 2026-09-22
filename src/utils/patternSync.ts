import type { Pattern } from '../domain/pattern';
import { getPattern, writePlatformStore } from './platformStore';
import { apiFetch } from './apiClient';
import { toast } from '@/components/ui/ToastProvider';
import { getOriginalImage, putOriginalImage } from '../infrastructure/storage';
import { uploadPatternOriginal } from './patternOriginalUpload';

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
  // 不把 base64 原图塞进本地；保留 R2 key
  const slimRemote: Pattern = {
    ...remote,
    data: {
      ...remote.data,
      originalImageSrc: null,
      originalImageKey: remote.data.originalImageKey ?? null,
    },
  };
  const idx = store.patterns.findIndex((p) => p.id === remote.id);
  if (idx < 0) {
    store.patterns.unshift(slimRemote);
    writeStore(store);
    return;
  }
  const local = store.patterns[idx];
  if ((remote.updatedAt || 0) >= (local.updatedAt || 0)) {
    store.patterns[idx] = {
      ...slimRemote,
      data: {
        ...slimRemote.data,
        // 本地若已有 key 且远端暂时没有，别冲掉
        originalImageKey:
          slimRemote.data.originalImageKey || local.data.originalImageKey || null,
      },
    };
    writeStore(store);
  }
}

function patchLocalOriginalKey(patternId: string, key: string) {
  const store = readStore();
  const idx = store.patterns.findIndex((p) => p.id === patternId);
  if (idx < 0) return;
  store.patterns[idx] = {
    ...store.patterns[idx],
    data: {
      ...store.patterns[idx].data,
      originalImageKey: key,
      originalImageSrc: null,
    },
  };
  writeStore(store);
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
    const local = getPattern(pattern.id);
    const latest: Pattern =
      local && (local.updatedAt || 0) > (pattern.updatedAt || 0) ? local : pattern;

    // 原图：优先内存/入参 dataURL，其次 IndexedDB
    let dataUrl =
      (typeof pattern.data.originalImageSrc === 'string' &&
      pattern.data.originalImageSrc.startsWith('data:')
        ? pattern.data.originalImageSrc
        : null) ||
      (typeof latest.data.originalImageSrc === 'string' &&
      latest.data.originalImageSrc.startsWith('data:')
        ? latest.data.originalImageSrc
        : null);

    if (!dataUrl) {
      dataUrl = await getOriginalImage(pattern.id);
    }

    let originalImageKey =
      latest.data.originalImageKey || pattern.data.originalImageKey || null;

    if (dataUrl) {
      void putOriginalImage(pattern.id, dataUrl);
      const uploaded = await uploadPatternOriginal(pattern.id, dataUrl);
      if (uploaded) {
        originalImageKey = uploaded.key;
        patchLocalOriginalKey(pattern.id, uploaded.key);
      }
    }

    // D1 只存格子 + R2 key，绝不存 base64
    const forCloud: Pattern = {
      ...latest,
      id: pattern.id,
      name: pattern.name || latest.name,
      description: pattern.description ?? latest.description,
      tags: pattern.tags ?? latest.tags,
      visibility: pattern.visibility ?? latest.visibility,
      updatedAt: pattern.updatedAt || latest.updatedAt || Date.now(),
      data: {
        ...latest.data,
        ...pattern.data,
        originalImageSrc: null,
        originalImageKey,
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
