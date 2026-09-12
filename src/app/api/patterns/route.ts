import { NextResponse } from 'next/server';
export async function GET() { return NextResponse.json({ patterns: [], message: 'D1 adapter pending deployment binding' }); }
export async function POST() { return NextResponse.json({ error: 'Authentication adapter is not configured' }, { status: 501 }); }
