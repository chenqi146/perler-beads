import type { CraftSession, Pattern, PatternData, Visibility, Work } from '../types/platform';

const KEY = 'perler-platform-v1';
interface Store { patterns: Pattern[]; sessions: CraftSession[]; works: Work[]; }
const empty: Store = { patterns: [], sessions: [], works: [] };
const read = (): Store => {
  if (typeof window === 'undefined') return empty;
  try { return { ...empty, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return empty; }
};
const write = (store: Store) => localStorage.setItem(KEY, JSON.stringify(store));
const id = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
/** 仅读取已登录用户 id，不再自动创建游客身份（避免未登录也能写图纸） */
export function getLoggedInUserId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('perler-user-id');
}

const ownerId = () => {
  const value = getLoggedInUserId();
  if (!value) throw new Error('请先登录后再操作图纸');
  return value;
};

export function listPatterns(): Pattern[] { return read().patterns.filter(p => p.ownerId === ownerId()).sort((a, b) => b.updatedAt - a.updatedAt); }
export function deletePattern(patternId: string): void { const store = read(); store.patterns = store.patterns.filter(p => p.id !== patternId || p.ownerId !== ownerId()); write(store); }
export function getPattern(patternId: string): Pattern | undefined { return read().patterns.find(p => p.id === patternId); }
export function duplicatePattern(patternId: string): Pattern | undefined { const source = getPattern(patternId); if (!source) return undefined; return savePattern({ name: `${source.name}（副本）`, description: source.description, tags: [...source.tags], visibility: 'private', data: JSON.parse(JSON.stringify(source.data)) }); }
export function savePattern(input: Pick<Pattern, 'name' | 'description' | 'tags' | 'visibility' | 'data'>, patternId?: string): Pattern {
  const store = read(); const now = Date.now(); const current = patternId ? store.patterns.find(p => p.id === patternId) : undefined;
  const pattern: Pattern = { id: current?.id || id('pattern'), ownerId: ownerId(), createdAt: current?.createdAt || now, updatedAt: now, ...input };
  store.patterns = current ? store.patterns.map(p => p.id === pattern.id ? pattern : p) : [pattern, ...store.patterns]; write(store); return pattern;
}
export function createSession(pattern: Pattern): CraftSession { const store = read(); const session: CraftSession = { id: id('craft'), patternId: pattern.id, ownerId: ownerId(), patternSnapshot: pattern.data, completedCells: [], elapsedSeconds: 0, status: 'active', createdAt: Date.now(), updatedAt: Date.now() }; store.sessions.unshift(session); write(store); return session; }
export function listSessions(patternId?: string): CraftSession[] { return read().sessions.filter(s => s.ownerId === ownerId() && (!patternId || s.patternId === patternId)); }
export function saveSession(session: CraftSession): CraftSession { const store = read(); const next = { ...session, updatedAt: Date.now() }; store.sessions = store.sessions.map(s => s.id === session.id ? next : s); write(store); return next; }
export function listPublicPatterns(): Pattern[] { return read().patterns.filter(p => p.visibility === 'public'); }
export function listWorks(): Work[] { return read().works.filter(w => w.ownerId === ownerId()); }
export function saveWork(input: Omit<Work, 'id' | 'ownerId' | 'createdAt'>): Work { const store = read(); const work = { ...input, id: id('work'), ownerId: ownerId(), createdAt: Date.now() }; store.works.unshift(work); write(store); return work; }
export type { PatternData, Visibility };
