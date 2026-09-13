import { apiFetch } from './apiClient';

export type CraftSessionPushInput = {
  id?: string;
  patternId: string;
  completedCells: string[];
  elapsedSeconds?: number;
  status?: 'active' | 'paused' | 'completed';
  patternSnapshot?: unknown;
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

export async function loadCraftSessionForPattern(patternId: string): Promise<{
  id: string;
  completedCells: string[];
  elapsedSeconds: number;
  status: string;
} | null> {
  try {
    const res = await apiFetch(
      `/api/craft-sessions?patternId=${encodeURIComponent(patternId)}`,
    );
    if (!res.ok) return null;
    const data = await res.json();
    const sessions = Array.isArray(data.sessions) ? data.sessions : [];
    const first = sessions[0];
    if (!first?.id) return null;
    setLocalCraftSessionId(patternId, String(first.id));
    return {
      id: String(first.id),
      completedCells: Array.isArray(first.completedCells) ? first.completedCells.map(String) : [],
      elapsedSeconds: Number(first.elapsedSeconds) || 0,
      status: String(first.status || 'active'),
    };
  } catch {
    return null;
  }
}
