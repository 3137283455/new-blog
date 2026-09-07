import { NextResponse } from 'next/server';
import { internalApiOrigin } from '../../shared/site/settings';
export async function GET() { try { const response = await fetch(`${internalApiOrigin()}/api/rss`, { cache: 'no-store' }); return new NextResponse(await response.text(), { status: response.status, headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } }); } catch { return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>My Blog</title></channel></rss>', { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } }); } }
