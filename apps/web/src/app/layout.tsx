import type { ReactNode } from 'react';
import type { Viewport } from 'next';
import { getSiteSettings, themeCss } from '../shared/site/settings';
import { SiteEffects } from '../shared/site/site-effects';
import { SiteFrame } from '../shared/site/site-frame';
import { getJson } from '../shared/http/json';
import { internalApiOrigin } from '../shared/site/settings';
import type { MusicTrack } from '../shared/site/music-player';
// Transitional shared visual contract: no replacement theme or component-library reset.
import '../../../../frontend-astro/src/styles/global.scss';
import '../features/manga/styles/MangaSiteHeader.css';
import '../features/manga/styles/MangaSourcePicker.css';
import '../features/manga/styles/MangaPortal.css';
import '../features/manga/styles/MangaBrowsePage.css';
import '../features/manga/styles/SourceDetail.css';
import '../features/manga/styles/MangaRank.css';
import '../features/manga/styles/MangaLibrary.css';
import '../features/manga/styles/MangaDetail.css';
import '../features/manga/styles/SourceReader.css';
import '../features/manga/styles/LocalReader.css';
import '../features/reading/reading-hub.css';

export const dynamic = 'force-dynamic';
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#f4f2ea' };

const bootstrap = `try{var t=localStorage.getItem('theme')||'boke-green';document.documentElement.setAttribute('data-theme',t);document.documentElement.setAttribute('data-theme-type',({'boke-night':'dark','boke-punk':'dark','boke-green':'light'})[t]||'light')}catch{}window.__PUBLIC_API_BASE__='/api';`;

export default async function RootLayout({ children }: { children: ReactNode }) {
  const { settings, theme } = await getSiteSettings();
  const music = await getJson<MusicTrack[]>(
    `${internalApiOrigin()}/api/music`,
    AbortSignal.timeout(10000),
  ).catch(() => []);
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
        <style dangerouslySetInnerHTML={{ __html: themeCss(theme) }} />
        <script dangerouslySetInnerHTML={{ __html: bootstrap }} />
      </head>
      <body
        className="flex min-h-screen flex-col bg-[var(--banner-wave-bg)] layout-full-bleed"
        data-site-start-date={settings.site_start_date || '2026-01-01'}
      >
        <div className="site-bg-grid" />
        <SiteFrame
          settings={settings}
          tracks={music.length ? music : settings.music_playlist || []}
        >
          {children}
        </SiteFrame>
        <SiteEffects />
      </body>
    </html>
  );
}
