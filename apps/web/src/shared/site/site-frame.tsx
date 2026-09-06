'use client';
import { useEffect, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { SiteNavigation } from './navigation';
import { MusicPlayer, type MusicTrack } from './music-player';
import type { SiteSettings } from './settings';
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
  const sourceReader = /^\/source\/[^/]+\/[^/]+\/chapter\/[^/]+\/?$/.test(path);
  const localReader = /^\/manga\/[^/]+\/[^/]+\/[^/]+\/?$/.test(path);
  const fullBleed = !sourceReader;
  useEffect(() => {
    document.body.classList.toggle('layout-full-bleed', fullBleed);
  }, [fullBleed]);
  return (
    <>
      {sourceReader && <SiteNavigation settings={settings} />}
      <div
        className={`page-content-animate mx-auto w-full flex-grow ${fullBleed ? 'max-w-none mt-0' : 'max-w-wide mt-24'}`}
      >
        <div className={`grid grid-cols-1 ${fullBleed ? 'gap-0 px-0 pb-0' : 'gap-4 px-4 pb-4'}`}>
          <main className="order-1 flex flex-col gap-4 ">{children}</main>
        </div>
      </div>
      {(sourceReader || localReader) && <MusicPlayer tracks={tracks} />}
    </>
  );
}
