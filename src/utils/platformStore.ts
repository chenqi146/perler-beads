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

export type LoggedInUser = {
  id: string;
  email: string | null;
  name: string | null;
  displayName: string;
  initial: string;
};

/** 读取本地登录用户展示信息（昵称优先，其次账号） */
export function getLoggedInUser(): LoggedInUser | null {
  if (typeof window === 'undefined') return null;
  const id = localStorage.getItem('perler-user-id');
  if (!id) return null;
  const email = localStorage.getItem('perler-user-email');
  const name = localStorage.getItem('perler-user-name');
  const fromEmail = email?.split('@')[0]?.trim() || null;
  const displayName = (name?.trim() || fromEmail || '拼豆玩家').trim();
  const initial = Array.from(displayName)[0]?.toUpperCase() || '豆';
  return { id, email, name, displayName, initial };
}

/** 清除本地登录态 */
export function clearLoggedInUser(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('perler-user-id');
  localStorage.removeItem('perler-user-email');
  localStorage.removeItem('perler-user-name');
}

/** 将本地图纸/会话/作品的 ownerId 从旧假 id 迁到新 UUID */
export function remapLocalOwnerId(fromOwnerId: string, toOwnerId: string): void {
  if (typeof window === 'undefined' || !fromOwnerId || !toOwnerId || fromOwnerId === toOwnerId) return;
  const store = read();
  let changed = false;
  store.patterns = store.patterns.map((p) => {
    if (p.ownerId !== fromOwnerId) return p;
    changed = true;
    return { ...p, ownerId: toOwnerId, updatedAt: Date.now() };
  });
  store.sessions = store.sessions.map((s) => {
    if (s.ownerId !== fromOwnerId) return s;
    changed = true;
    return { ...s, ownerId: toOwnerId, updatedAt: Date.now() };
  });
  store.works = store.works.map((w) => {
    if (w.ownerId !== fromOwnerId) return w;
    changed = true;
    return { ...w, ownerId: toOwnerId };
  });
  if (changed) write(store);
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
