'use client';
import { useEffect, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { SiteNavigation } from './navigation';
import { MusicPlayer, type MusicTrack } from './music-player';
import type { PublicTheme, SiteSettings } from './settings';
import { SiteFooter } from './footer';
export function SiteFrame({
  children,
  settings,
  appearanceThemes,
  tracks,
}: {
  children: ReactNode;
  settings: SiteSettings;
  appearanceThemes: PublicTheme[];
  tracks: MusicTrack[];
}) {
  const path = usePathname();
  const admin = path === '/admin' || path.startsWith('/admin/');
  const sourceReader = /^\/source\/[^/]+\/[^/]+\/chapter\/[^/]+\/?$/.test(path);
  const localReader = /^\/manga\/[^/]+\/[^/]+\/[^/]+\/?$/.test(path);
  const readingHub = path === '/reading';
  const bookPage = path === '/books' || path.startsWith('/books/');
  const bookReader = /^\/books\/[^/]+\/(?:read|[^/]+\/[^/]+)\/?$/.test(path);
  const articleReader = /^\/article\/[^/]+\/?$/.test(path);
  const mangaPage = path === '/manga' || path.startsWith('/manga/') || path === '/source' || path.startsWith('/source/');
  const mangaReader = sourceReader || localReader;
  const mangaPortalPage = mangaPage && !mangaReader;
  const bannerPage =
    path === '/' ||
    path === '/archive' ||
    path === '/search' ||
    path === '/series' ||
    /^\/series\/[^/]+\/?$/.test(path) ||
    path === '/albums' ||
    /^\/albums\/[^/]+\/?$/.test(path) ||
    path === '/memories' ||
    /^\/page\/[^/]+\/?$/.test(path);
  const widePage =
    /^\/article\/[^/]+\/?$/.test(path) ||
    path === '/nav' ||
    path === '/reading' ||
    /^\/books\/[^/]+\/?$/.test(path);
  const publicPage = !admin && !sourceReader && !localReader && !mangaPage;
  const fullBleed = mangaReader || bookReader || articleReader;
  const showSiteNavigation = !bookReader && !articleReader && (publicPage || mangaPortalPage || readingHub || bookPage);
  useEffect(() => {
    const themeTypes = {
      'boke-green': 'light',
      'boke-night': 'dark',
      'boke-punk': 'dark',
    } as const;
    const defaultTheme = appearanceThemes.find((theme) => theme.is_active)?.id || 'boke-green';
    const storedTheme = localStorage.getItem('theme');
    const publicTheme = storedTheme && storedTheme in themeTypes
      ? storedTheme as keyof typeof themeTypes
      : defaultTheme;
    document.documentElement.dataset.siteLayout = admin ? 'admin' : 'public';
    document.documentElement.dataset.theme = admin ? 'boke-admin' : publicTheme;
    document.documentElement.dataset.themeType = admin ? 'light' : themeTypes[publicTheme];
    document.body.className = admin
      ? 'admin-body min-h-screen text-base-content'
      : `flex min-h-screen flex-col bg-[var(--banner-wave-bg)]${fullBleed ? ' layout-full-bleed' : ''}`;
  }, [appearanceThemes, fullBleed, admin]);
  if (admin) return children;
  return (
    <>
      <div className="site-bg-grid" aria-hidden="true" />
      {showSiteNavigation && (
        <SiteNavigation settings={settings} appearanceThemes={appearanceThemes} immersive={bannerPage} />
      )}
      <div
        className={`page-content-animate mx-auto w-full flex-grow ${fullBleed || bannerPage ? 'max-w-none mt-0' : widePage || mangaPortalPage ? 'max-w-wide mt-24' : 'max-w-blog mt-24'}`}
      >
        <div
          className={`grid grid-cols-1 ${fullBleed || bannerPage ? 'gap-0 px-0 pb-0' : 'gap-4 px-4 pb-4'}`}
        >
          <main
            className={`order-1 flex flex-col ${fullBleed || bannerPage ? 'gap-0' : 'gap-4'}`}
          >
            {children}
          </main>
        </div>
      </div>
      {!bookReader && !articleReader && (publicPage || mangaPortalPage || readingHub || bookPage) && <SiteFooter settings={settings} />}
      {!articleReader && (publicPage || mangaPage || readingHub || bookPage) && <MusicPlayer tracks={tracks} />}
    </>
  );
}
