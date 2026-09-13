import { clearLoggedInUser } from './platformStore';
import { toast } from '@/components/ui/ToastProvider';

export type ApiFetchOptions = {
  /** 401 时跳转登录并 toast（默认 true） */
  authRedirect?: boolean;
  /** 401 时自定义提示 */
  unauthorizedMessage?: string;
};

let redirecting401 = false;

function redirectToLogin() {
  if (typeof window === 'undefined') return;
  if (window.location.pathname.startsWith('/auth/')) return;
  if (redirecting401) return;
  redirecting401 = true;
  const next = `${window.location.pathname}${window.location.search}`;
  window.location.href = `/auth/login?next=${encodeURIComponent(next)}`;
}

/** 带 credentials 的 fetch；401 清登录态、toast、跳转登录页 */
export async function apiFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
  options?: ApiFetchOptions,
): Promise<Response> {
  const res = await fetch(input, {
    ...init,
    credentials: init?.credentials ?? 'include',
  });

  if (res.status === 401 && options?.authRedirect !== false) {
    clearLoggedInUser();
    toast(options?.unauthorizedMessage || '请先登录');
    redirectToLogin();
  }

  return res;
}
