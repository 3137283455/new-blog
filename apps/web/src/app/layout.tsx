import type { ReactNode } from 'react';
import type { Viewport } from 'next';
import { getSiteSettings, themeCss } from '../shared/site/settings';
import { SiteEffects } from '../shared/site/site-effects';
// Transitional shared visual contract: no replacement theme or component-library reset.
import '../../../../frontend-astro/src/styles/global.scss';
import '../features/manga/styles/MangaSiteHeader.css';
import '../features/manga/styles/MangaSourcePicker.css';
import '../features/manga/styles/MangaPortal.css';
import '../features/manga/styles/MangaBrowsePage.css';

export const dynamic = 'force-dynamic';
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#f4f2ea' };

const bootstrap = `try{var t=localStorage.getItem('theme')||'boke-green';document.documentElement.setAttribute('data-theme',t);document.documentElement.setAttribute('data-theme-type',({'boke-night':'dark','boke-punk':'dark','boke-green':'light'})[t]||'light')}catch{}window.__PUBLIC_API_BASE__='/api';`;

export default async function RootLayout({ children }: { children: ReactNode }) {
  const { settings, theme } = await getSiteSettings();
  return (
    <html
      lang={settings.site_language || 'zh-CN'}
      data-theme="boke-green"
      data-theme-type="light"
      data-personal-season={theme.season || 'custom'}
      suppressHydrationWarning
    >
      <head>
        <style dangerouslySetInnerHTML={{ __html: themeCss(theme) }} />
        <script dangerouslySetInnerHTML={{ __html: bootstrap }} />
      </head>
      <body
        className="flex min-h-screen flex-col bg-[var(--banner-wave-bg)] layout-full-bleed"
        data-site-start-date={settings.site_start_date || '2026-01-01'}
      >
        <div className="site-bg-grid" />
        <div className="page-content-animate mx-auto w-full flex-grow max-w-none mt-0">
          <div className="grid grid-cols-1 gap-0 px-0 pb-0">
            <main className="order-1 flex flex-col gap-4 ">{children}</main>
          </div>
        </div>
        <SiteEffects />
      </body>
    </html>
  );
}
