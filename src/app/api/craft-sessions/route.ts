import { NextResponse } from 'next/server';

export async function GET() { return NextResponse.json({ sessions: [], message: 'D1 adapter pending deployment binding' }); }
export async function POST(request: Request) { const body = await request.json().catch(() => null); if (!body?.patternId) return NextResponse.json({ error: 'patternId is required' }, { status: 400 }); return NextResponse.json({ error: 'Authentication adapter is not configured' }, { status: 501 }); }
