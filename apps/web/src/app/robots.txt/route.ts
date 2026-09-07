import { NextResponse } from 'next/server';
export function GET() { return new NextResponse('User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api\n', { headers: { 'Content-Type': 'text/plain; charset=utf-8' } }); }
