import { NextResponse } from 'next/server';
import { getCurrentUser, type SessionUser } from './auth';

/** API：正式账号，否则 401 */
export async function requireRegisteredApi(): Promise<SessionUser | NextResponse> {
  const user = await getCurrentUser();
  if (!user || user.isAnonymous) {
    return NextResponse.json({ error: '请登录账号后使用豆仓' }, { status: 401 });
  }
  return user;
}

export function isErrorResponse(value: SessionUser | NextResponse): value is NextResponse {
  return value instanceof NextResponse;
}
