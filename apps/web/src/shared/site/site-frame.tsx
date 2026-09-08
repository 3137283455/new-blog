'use client';
import { useEffect, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { SiteNavigation } from './navigation';
import { MusicPlayer, type MusicTrack } from './music-player';
import type { SiteSettings } from './settings';
import { SiteFooter } from './footer';
export function SiteFrame({
  children,
  settings,
  tracks,
}: {
  children: ReactNode;
  settings: SiteSettings;
  tracks: MusicTrack[];
}) {
  const path = usePathname();
  const admin = path === '/admin' || path.startsWith('/admin/');
  const sourceReader = /^\/source\/[^/]+\/[^/]+\/chapter\/[^/]+\/?$/.test(path);
  const localReader = /^\/manga\/[^/]+\/[^/]+\/[^/]+\/?$/.test(path);
  const readingHub = path === '/reading';
  const bookPage = path === '/books' || path.startsWith('/books/');
  const mangaPage = path === '/manga' || path.startsWith('/manga/') || path === '/source' || path.startsWith('/source/');
  const bannerPage =
    path === '/' ||
    path === '/archive' ||
    path === '/search' ||
    path === '/series' ||
    /^\/series\/[^/]+\/?$/.test(path) ||
    path === '/albums' ||
    /^\/albums\/[^/]+\/?$/.test(path) ||
    path === '/memories' ||
    /^\/article\/[^/]+\/?$/.test(path) ||
    /^\/page\/[^/]+\/?$/.test(path);
  const widePage =
    /^\/article\/[^/]+\/?$/.test(path) ||
    path === '/nav' ||
    path === '/reading' ||
    /^\/books\/[^/]+\/?$/.test(path);
  const publicPage = !admin && !sourceReader && !localReader && !mangaPage;
  const fullBleed = mangaPage && !readingHub && !bookPage;
  useEffect(() => {
    document.documentElement.dataset.siteLayout = admin ? 'admin' : 'public';
    document.body.className = admin
      ? 'admin-body min-h-screen text-base-content'
      : `flex min-h-screen flex-col bg-[var(--banner-wave-bg)]${fullBleed ? ' layout-full-bleed' : ''}`;
  }, [fullBleed, admin]);
  if (admin) return children;
  return (
    <>
      <div className="site-bg-grid" aria-hidden="true" />
      {(publicPage || sourceReader || readingHub || bookPage) && (
        <SiteNavigation settings={settings} immersive={bannerPage} />
      )}
      <div
        className={`page-content-animate mx-auto w-full flex-grow ${fullBleed || bannerPage ? 'max-w-none mt-0' : widePage ? 'max-w-wide mt-24' : 'max-w-blog mt-24'}`}
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
      {(publicPage || readingHub || bookPage) && <SiteFooter settings={settings} />}
      {(publicPage || sourceReader || localReader || readingHub || bookPage) && <MusicPlayer tracks={tracks} />}
    </>
  );
}
