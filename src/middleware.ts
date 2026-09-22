import { NextResponse } from 'next/server';

/**
 * 创作与个人页不再强制跳登录：身份由 /api/auth/anonymous Cookie 绑定浏览器。
 * 保留 middleware 入口便于后续加安全头等。
 */
export function middleware() {
  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/patterns/:path*', '/works/:path*', '/profile/:path*'],
};
