import {
  clearLoggedInUser,
  getLoggedInUserId,
  remapLocalOwnerId,
} from '@/utils/platformStore';

export type AuthSuccessPayload = {
  id: string;
  name: string;
  email: string;
};

/** 写入本地登录态，并把假 user_* owner 图纸迁到服务端 UUID */
export function applyAuthSuccess(payload: AuthSuccessPayload) {
  const email = payload.email.trim().toLowerCase();
  const legacyId = `user_${email.replace(/[^a-z0-9]+/g, '-')}`;
  const previousId = getLoggedInUserId();

  localStorage.setItem('perler-user-id', payload.id);
  localStorage.setItem('perler-user-email', email);
  localStorage.setItem('perler-user-name', payload.name);

  if (legacyId !== payload.id) {
    remapLocalOwnerId(legacyId, payload.id);
  }
  if (previousId && previousId !== payload.id && previousId.startsWith('user_')) {
    remapLocalOwnerId(previousId, payload.id);
  }
}

export async function logoutRemote() {
  try {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
  } catch {
    // ignore
  }
  clearLoggedInUser();
}
