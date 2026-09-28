import { apiFetch } from './apiClient';
import type { CraftStatus } from '../domain/pattern';
import type { BeadCraftPhase } from '../application/bead/beadProgressSummary';
import { useBeadProgressStore } from '../application/bead/beadProgressStore';

export type CraftSessionPushInput = {
  id?: string;
  patternId: string;
  completedCells: string[];
  elapsedSeconds?: number;
  status?: CraftStatus;
  patternSnapshot?: unknown;
};

export type CraftSessionRemote = {
  id: string;
  patternId: string;
  completedCells: string[];
  elapsedSeconds: number;
  status: CraftStatus;
  updatedAt?: number;
};

const SESSION_ID_KEY = (patternId: string) => `perler-craft-session:${patternId}`;

export function getLocalCraftSessionId(patternId: string): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(SESSION_ID_KEY(patternId));
}

export function setLocalCraftSessionId(patternId: string, sessionId: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SESSION_ID_KEY(patternId), sessionId);
}

/** 列表页拼豆阶段 → 后台 craft_sessions.status */
export function phaseToCraftStatus(phase: BeadCraftPhase): CraftStatus {
  switch (phase) {
    case 'not_started':
      return 'not_started';
    case 'paused':
      return 'paused';
    case 'completed':
      return 'completed';
    case 'in_progress':
    default:
      return 'active';
  }
}

/** 后台 status → 列表页拼豆阶段 */
export function craftStatusToPhase(status: string | null | undefined): BeadCraftPhase {
  switch (status) {
    case 'not_started':
      return 'not_started';
    case 'paused':
      return 'paused';
    case 'completed':
      return 'completed';
    case 'active':
    default:
      return 'in_progress';
  }
}

function normalizeCraftStatus(value: unknown): CraftStatus {
  if (value === 'not_started' || value === 'paused' || value === 'completed' || value === 'active') {
    return value;
  }
  return 'active';
}

export async function pushCraftSession(input: CraftSessionPushInput): Promise<string | null> {
  try {
    const existingId = input.id || getLocalCraftSessionId(input.patternId) || undefined;
    const res = await apiFetch('/api/craft-sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: existingId,
        patternId: input.patternId,
        completedCells: input.completedCells,
        elapsedSeconds: input.elapsedSeconds ?? 0,
        status: input.status ?? 'active',
        patternSnapshot: input.patternSnapshot,
      }),
    });
    if (!res.ok) return existingId ?? null;
    const data = await res.json();
    const id = data?.session?.id ? String(data.session.id) : null;
    if (id) setLocalCraftSessionId(input.patternId, id);
    return id;
  } catch {
    return getLocalCraftSessionId(input.patternId);
  }
}

/** 推送当前图纸的拼豆状态与格子到后台 */
export async function pushCraftStatusForPattern(
  patternId: string,
  phase: BeadCraftPhase,
  options?: { patternSnapshot?: unknown; elapsedSeconds?: number },
): Promise<string | null> {
  const cells = useBeadProgressStore.getState().getCells(patternId);
  return pushCraftSession({
    patternId,
    completedCells: cells,
    status: phaseToCraftStatus(phase),
    patternSnapshot: options?.patternSnapshot,
    elapsedSeconds: options?.elapsedSeconds,
  });
}

function parseSession(raw: Record<string, unknown>): CraftSessionRemote | null {
  if (!raw?.id || !raw?.patternId) return null;
  return {
    id: String(raw.id),
    patternId: String(raw.patternId),
    completedCells: Array.isArray(raw.completedCells)
      ? raw.completedCells.map(String)
      : [],
    elapsedSeconds: Number(raw.elapsedSeconds) || 0,
    status: normalizeCraftStatus(raw.status),
    updatedAt: Number(raw.updatedAt) || undefined,
  };
}

export async function loadCraftSessionForPattern(
  patternId: string,
): Promise<CraftSessionRemote | null> {
  try {
    const res = await apiFetch(
      `/api/craft-sessions?patternId=${encodeURIComponent(patternId)}`,
    );
    if (!res.ok) return null;
    const data = await res.json();
    const sessions = Array.isArray(data.sessions) ? data.sessions : [];
    const first = sessions[0] as Record<string, unknown> | undefined;
    if (!first) return null;
    const parsed = parseSession(first);
    if (!parsed) return null;
    setLocalCraftSessionId(patternId, parsed.id);
    return parsed;
  } catch {
    return null;
  }
}

/** 拉取当前用户全部拼豆会话 */
export async function loadAllCraftSessions(): Promise<CraftSessionRemote[]> {
  try {
    const res = await apiFetch('/api/craft-sessions');
    if (!res.ok) return [];
    const data = await res.json();
    const sessions = Array.isArray(data.sessions) ? data.sessions : [];
    const out: CraftSessionRemote[] = [];
    const seen = new Set<string>();
    for (const raw of sessions) {
      const parsed = parseSession(raw as Record<string, unknown>);
      if (!parsed) continue;
      // API 按 updated_at DESC；每个 pattern 只取最新一条
      if (seen.has(parsed.patternId)) continue;
      seen.add(parsed.patternId);
      setLocalCraftSessionId(parsed.patternId, parsed.id);
      out.push(parsed);
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * 从云端会话回填本地进度与拼豆状态。
 * 格子取并集；状态以云端为准。
 */
export async function hydrateBeadProgressFromCloud(): Promise<number> {
  const sessions = await loadAllCraftSessions();
  if (sessions.length === 0) return 0;

  const store = useBeadProgressStore.getState();
  for (const session of sessions) {
    const localCells = store.getCells(session.patternId);
    const merged = Array.from(new Set([...localCells, ...session.completedCells]));
    store.hydrateFromRemote(session.patternId, {
      completedCells: merged,
      manualStatus: craftStatusToPhase(session.status),
    });
  }
  return sessions.length;
}
