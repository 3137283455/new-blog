import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import type { Viewport } from 'next';
import { getSiteSettings, themeCss } from '../shared/site/settings';

export const dynamic = 'force-dynamic';
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#f4f2ea' };
export const metadata: Metadata = {
  icons: { icon: '/logo.png', apple: '/logo.png' },
};

const bootstrap = `try{var t=localStorage.getItem('theme')||'boke-green';document.documentElement.setAttribute('data-theme',t);document.documentElement.setAttribute('data-theme-type',({'boke-night':'dark','boke-punk':'dark','boke-green':'light'})[t]||'light')}catch{}window.__PUBLIC_API_BASE__='/api';`;

export default async function RootLayout({ children }: { children: ReactNode }) {
  const { settings, theme } = await getSiteSettings();
  return (
    <html
      lang={settings.site_language || 'zh-CN'}
      data-theme="boke-green"
      data-theme-type="light"
      data-scroll-behavior="smooth"
      data-personal-season={theme.season || 'custom'}
      suppressHydrationWarning
    >
      <head>
        <style
          dangerouslySetInnerHTML={{
            __html: themeCss(theme).replace(':root{', ':root:not([data-site-layout="admin"]){'),
          }}
        />
        <script dangerouslySetInnerHTML={{ __html: bootstrap }} />
      </head>
      <body
        className="flex min-h-screen flex-col bg-[var(--banner-wave-bg)] layout-full-bleed"
        data-site-start-date={settings.site_start_date || '2026-01-01'}
      >
        <div className="site-bg-grid" />
        {children}
      </body>
    </html>
  );
}
