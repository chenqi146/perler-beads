import type { CraftSession, Pattern, PatternData, Visibility, Work } from '../types/platform';

const KEY = 'perler-platform-v1';

interface Store {
  patterns: Pattern[];
  sessions: CraftSession[];
  works: Work[];
}

const empty: Store = { patterns: [], sessions: [], works: [] };

function isQuotaExceeded(err: unknown): boolean {
  return (
    err instanceof DOMException &&
    (err.name === 'QuotaExceededError' || err.name === 'NS_ERROR_DOM_QUOTA_REACHED')
  );
}

/** 本地缓存不存原图 base64，避免撑爆 5MB 配额（格子数据足够编辑/拼豆） */
function stripHeavyPatternData(data: PatternData): PatternData {
  return { ...data, originalImageSrc: null };
}

function slimStore(store: Store): Store {
  return {
    patterns: store.patterns.map((p) => ({
      ...p,
      data: stripHeavyPatternData(p.data),
    })),
    sessions: store.sessions.map((s) => ({
      ...s,
      patternSnapshot: stripHeavyPatternData(s.patternSnapshot),
    })),
    works: store.works.map((w) => ({
      ...w,
      // 作品若误存超大 dataURL，截断为占位
      imageUrl:
        typeof w.imageUrl === 'string' && w.imageUrl.startsWith('data:') && w.imageUrl.length > 200_000
          ? ''
          : w.imageUrl,
    })),
  };
}

function pruneStore(store: Store, maxPatterns = 8, maxSessions = 8, maxWorks = 16): Store {
  const patterns = [...store.patterns]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, maxPatterns);
  const sessions = [...store.sessions]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, maxSessions);
  const works = [...store.works]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, maxWorks);
  return slimStore({ patterns, sessions, works });
}

const read = (): Store => {
  if (typeof window === 'undefined') return empty;
  try {
    return { ...empty, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return empty;
  }
};

/**
 * 写入平台本地缓存。配额不足时自动：去原图 → 裁剪旧条目 → 再试。
 */
export function writePlatformStore(store: Store): void {
  if (typeof window === 'undefined') return;
  const payload = slimStore(store);
  try {
    localStorage.setItem(KEY, JSON.stringify(payload));
    return;
  } catch (err) {
    if (!isQuotaExceeded(err)) throw err;
  }

  // 清掉可能占用配额的草稿后再试
  try {
    localStorage.removeItem('perlerBeads_projectDraft_v1');
  } catch {
    // ignore
  }

  try {
    localStorage.setItem(KEY, JSON.stringify(payload));
    return;
  } catch (err) {
    if (!isQuotaExceeded(err)) throw err;
  }

  const pruned = pruneStore(payload, 5, 5, 10);
  try {
    localStorage.setItem(KEY, JSON.stringify(pruned));
    return;
  } catch (err) {
    if (!isQuotaExceeded(err)) throw err;
  }

  const minimal = pruneStore(payload, 1, 0, 0);
  try {
    localStorage.setItem(KEY, JSON.stringify(minimal));
    return;
  } catch {
    throw new Error('浏览器本地存储已满，请清理站点数据或删除旧图纸后重试');
  }
}

const write = writePlatformStore;

/** 若本地仍存有原图 base64，立刻重写瘦身（修复历史配额问题） */
export function compactPlatformStoreIfNeeded(): void {
  if (typeof window === 'undefined') return;
  const store = read();
  const heavy =
    store.patterns.some((p) => Boolean(p.data?.originalImageSrc)) ||
    store.sessions.some((s) => Boolean(s.patternSnapshot?.originalImageSrc)) ||
    store.works.some(
      (w) => typeof w.imageUrl === 'string' && w.imageUrl.startsWith('data:') && w.imageUrl.length > 200_000,
    );
  if (!heavy) return;
  try {
    write(store);
  } catch (err) {
    console.warn('compactPlatformStoreIfNeeded failed:', err);
  }
}

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

export function listPatterns(): Pattern[] {
  return read()
    .patterns.filter((p) => p.ownerId === ownerId())
    .sort((a, b) => b.updatedAt - a.updatedAt);
}
export function deletePattern(patternId: string): void {
  const store = read();
  store.patterns = store.patterns.filter((p) => p.id !== patternId || p.ownerId !== ownerId());
  write(store);
}
export function getPattern(patternId: string): Pattern | undefined {
  return read().patterns.find((p) => p.id === patternId);
}
export function duplicatePattern(patternId: string): Pattern | undefined {
  const source = getPattern(patternId);
  if (!source) return undefined;
  return savePattern({
    name: `${source.name}（副本）`,
    description: source.description,
    tags: [...source.tags],
    visibility: 'private',
    data: JSON.parse(JSON.stringify(source.data)),
  });
}

/**
 * 保存图纸到本地（不落原图 base64）。
 * 返回值仍带完整 input.data，便于调用方同步云端。
 */
export function savePattern(
  input: Pick<Pattern, 'name' | 'description' | 'tags' | 'visibility' | 'data'>,
  patternId?: string,
): Pattern {
  const store = read();
  const now = Date.now();
  const current = patternId ? store.patterns.find((p) => p.id === patternId) : undefined;
  const pattern: Pattern = {
    id: current?.id || id('pattern'),
    ownerId: ownerId(),
    createdAt: current?.createdAt || now,
    updatedAt: now,
    ...input,
    data: stripHeavyPatternData(input.data),
  };
  store.patterns = current
    ? store.patterns.map((p) => (p.id === pattern.id ? pattern : p))
    : [pattern, ...store.patterns];
  write(store);
  // 内存返回保留原图，供云端推送 / 当前会话继续编辑
  return { ...pattern, data: input.data };
}

export function createSession(pattern: Pattern): CraftSession {
  const store = read();
  const session: CraftSession = {
    id: id('craft'),
    patternId: pattern.id,
    ownerId: ownerId(),
    patternSnapshot: stripHeavyPatternData(pattern.data),
    completedCells: [],
    elapsedSeconds: 0,
    status: 'active',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  store.sessions.unshift(session);
  write(store);
  return session;
}
export function listSessions(patternId?: string): CraftSession[] {
  return read().sessions.filter(
    (s) => s.ownerId === ownerId() && (!patternId || s.patternId === patternId),
  );
}
export function saveSession(session: CraftSession): CraftSession {
  const store = read();
  const next = {
    ...session,
    patternSnapshot: stripHeavyPatternData(session.patternSnapshot),
    updatedAt: Date.now(),
  };
  store.sessions = store.sessions.map((s) => (s.id === session.id ? next : s));
  write(store);
  return next;
}
export function listPublicPatterns(): Pattern[] {
  return read().patterns.filter((p) => p.visibility === 'public');
}
export function listWorks(): Work[] {
  return read().works.filter((w) => w.ownerId === ownerId());
}
export function saveWork(input: Omit<Work, 'id' | 'ownerId' | 'createdAt'>): Work {
  const store = read();
  const work = { ...input, id: id('work'), ownerId: ownerId(), createdAt: Date.now() };
  store.works.unshift(work);
  write(store);
  return work;
}
export type { PatternData, Visibility };
