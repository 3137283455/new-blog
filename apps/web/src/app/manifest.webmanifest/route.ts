import { NextResponse } from 'next/server';
export function GET() { return NextResponse.json({ name: 'My Blog', short_name: 'My Blog', start_url: '/', display: 'standalone', background_color: '#f8fff9', theme_color: '#16a34a', icons: [{ src: '/logo.png', sizes: '192x192', type: 'image/png' }] }); }
