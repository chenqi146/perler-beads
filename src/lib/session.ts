import { cookies } from 'next/headers';

export const SESSION_COOKIE = 'perler_session';
const DEFAULT_TTL_SEC = 60 * 60 * 24 * 30;

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET?.trim();
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') {
    console.warn('[session] SESSION_SECRET 未设置，使用弱默认密钥（请尽快配置）');
  }
  return 'perler-dev-session-secret';
}

function toBase64Url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  for (let i = 0; i < arr.length; i++) binary += String.fromCharCode(arr[i]!);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
  const binary = atob(padded + pad);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

async function hmacSign(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(getSessionSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return toBase64Url(sig);
}

async function hmacVerify(payload: string, signature: string): Promise<boolean> {
  const expected = await hmacSign(payload);
  if (expected.length !== signature.length) return false;
  let ok = 0;
  for (let i = 0; i < expected.length; i++) {
    ok |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return ok === 0;
}

/** 签发签名会话：userId.exp.sig */
export async function encodeSessionToken(userId: string, ttlSec = DEFAULT_TTL_SEC): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + ttlSec;
  const payload = `${userId}.${exp}`;
  const sig = await hmacSign(payload);
  return `${payload}.${sig}`;
}

export async function decodeSessionToken(token: string): Promise<string | null> {
  const parts = token.split('.');
  if (parts.length !== 3) {
    // 兼容旧版明文 userId cookie（仅开发过渡）
    if (parts.length === 1 && token && process.env.NODE_ENV !== 'production') {
      return token;
    }
    return null;
  }
  const [userId, expStr, sig] = parts;
  if (!userId || !expStr || !sig) return null;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp * 1000 < Date.now()) return null;
  const payload = `${userId}.${expStr}`;
  if (!(await hmacVerify(payload, sig))) return null;
  return userId;
}

export async function buildSessionCookie(userId: string) {
  const value = await encodeSessionToken(userId);
  return {
    name: SESSION_COOKIE,
    value,
    httpOnly: true,
    sameSite: 'lax' as const,
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    maxAge: DEFAULT_TTL_SEC,
  };
}

export function clearSessionCookie() {
  return {
    name: SESSION_COOKIE,
    value: '',
    httpOnly: true,
    sameSite: 'lax' as const,
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 0,
  };
}

export async function getSessionUserId(): Promise<string | null> {
  try {
    const jar = await cookies();
    const value = jar.get(SESSION_COOKIE)?.value?.trim();
    if (!value) return null;
    return decodeSessionToken(value);
  } catch {
    return null;
  }
}

/** @deprecated 仅供测试；勿在生产使用 */
export function _testHelpers() {
  return { fromBase64Url, toBase64Url };
}
