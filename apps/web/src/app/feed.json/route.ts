import { NextResponse } from 'next/server';
import { internalApiOrigin } from '../../shared/site/settings';
export async function GET() { try { const response = await fetch(`${internalApiOrigin()}/api/feed.json`, { cache: 'no-store' }); return new NextResponse(await response.text(), { status: response.status, headers: { 'Content-Type': 'application/feed+json; charset=utf-8' } }); } catch { return NextResponse.json({ version: 'https://jsonfeed.org/version/1', title: 'My Blog', items: [] }); } }
