import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { SESSION_COOKIE, decodeSessionToken } from '@/lib/session';

const PROTECTED_PREFIXES = ['/dashboard', '/patterns', '/works', '/profile'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const needsAuth = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  if (!needsAuth) return NextResponse.next();

  const token = request.cookies.get(SESSION_COOKIE)?.value?.trim();
  if (!token) {
    const login = new URL('/auth/login', request.url);
    login.searchParams.set('next', pathname);
    return NextResponse.redirect(login);
  }

  const userId = await decodeSessionToken(token);
  if (!userId) {
    const login = new URL('/auth/login', request.url);
    login.searchParams.set('next', pathname);
    const res = NextResponse.redirect(login);
    res.cookies.set({
      name: SESSION_COOKIE,
      value: '',
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });
    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/patterns/:path*', '/works/:path*', '/profile/:path*'],
};
