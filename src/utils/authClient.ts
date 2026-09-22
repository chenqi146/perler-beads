import {
  clearLoggedInUser,
  getLoggedInUserId,
  remapLocalOwnerId,
} from '@/utils/platformStore';

export type AuthSuccessPayload = {
  id: string;
  name: string;
  email: string;
  isAnonymous?: boolean;
};

const AUTH_CHANGED_EVENT = 'perler-auth-changed';

export function notifyAuthChanged() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
}

export function onAuthChanged(handler: () => void) {
  if (typeof window === 'undefined') return () => undefined;
  window.addEventListener(AUTH_CHANGED_EVENT, handler);
  return () => window.removeEventListener(AUTH_CHANGED_EVENT, handler);
}

/** 写入本地登录态，并把旧 owner（游客 / 假 user_*）图纸迁到新 id */
export function applyAuthSuccess(payload: AuthSuccessPayload) {
  const isAnonymous = Boolean(payload.isAnonymous);
  const email = isAnonymous ? '' : payload.email.trim().toLowerCase();
  const legacyId = email ? `user_${email.replace(/[^a-z0-9]+/g, '-')}` : '';
  const previousId = getLoggedInUserId();

  localStorage.setItem('perler-user-id', payload.id);
  localStorage.setItem('perler-user-name', payload.name || (isAnonymous ? '本机游客' : '拼豆玩家'));
  if (isAnonymous) {
    localStorage.removeItem('perler-user-email');
    localStorage.setItem('perler-user-anonymous', '1');
  } else {
    localStorage.setItem('perler-user-email', email);
    localStorage.removeItem('perler-user-anonymous');
  }

  if (legacyId && legacyId !== payload.id) {
    remapLocalOwnerId(legacyId, payload.id);
  }
  if (previousId && previousId !== payload.id) {
    remapLocalOwnerId(previousId, payload.id);
  }

  notifyAuthChanged();
}

let ensureInflight: Promise<AuthSuccessPayload> | null = null;

/** 确保本机有游客/正式会话（幂等）；无 Cookie 时自动创建匿名身份 */
export async function ensureAnonymousSession(): Promise<AuthSuccessPayload> {
  if (typeof window === 'undefined') {
    return { id: '', name: '本机游客', email: '', isAnonymous: true };
  }
  if (ensureInflight) return ensureInflight;

  ensureInflight = (async () => {
    const res = await fetch('/api/auth/anonymous', {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) {
      throw new Error('无法创建游客身份');
    }
    const data = (await res.json()) as {
      id: string;
      name?: string;
      email?: string | null;
      isAnonymous?: boolean;
    };
    const isAnonymous = Boolean(data.isAnonymous) || !data.email;
    const payload: AuthSuccessPayload = {
      id: data.id,
      name: data.name || (isAnonymous ? '本机游客' : '拼豆玩家'),
      email: data.email || '',
      isAnonymous,
    };
    // 已是同一用户则只补本地态，避免无谓 remap
    const previousId = getLoggedInUserId();
    if (previousId === payload.id) {
      localStorage.setItem('perler-user-name', payload.name);
      if (payload.isAnonymous) {
        localStorage.removeItem('perler-user-email');
        localStorage.setItem('perler-user-anonymous', '1');
      } else if (payload.email) {
        localStorage.setItem('perler-user-email', payload.email);
        localStorage.removeItem('perler-user-anonymous');
      }
      notifyAuthChanged();
      return payload;
    }
    applyAuthSuccess(payload);
    return payload;
  })();

  try {
    return await ensureInflight;
  } finally {
    ensureInflight = null;
  }
}

export async function logoutRemote() {
  try {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
  } catch {
    // ignore
  }
  clearLoggedInUser();
  notifyAuthChanged();
}
