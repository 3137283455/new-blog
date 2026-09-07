import type { ReactNode } from 'react';
import { SiteEffects } from '../../shared/site/site-effects';
import { SiteFrame } from '../../shared/site/site-frame';
import { getSiteSettings, internalApiOrigin } from '../../shared/site/settings';
import { getJson } from '../../shared/http/json';
import type { MusicTrack } from '../../shared/site/music-player';
// The standalone writer must never inherit the portal/admin reset or theme CSS.
import '../../styles/global.scss';
import '../../features/manga/styles/MangaSiteHeader.css';
import '../../features/manga/styles/MangaSourcePicker.css';
import '../../features/manga/styles/MangaPortal.css';
import '../../features/manga/styles/MangaBrowsePage.css';
import '../../features/manga/styles/SourceDetail.css';
import '../../features/manga/styles/MangaRank.css';
import '../../features/manga/styles/MangaLibrary.css';
import '../../features/manga/styles/MangaDetail.css';
import '../../features/manga/styles/SourceReader.css';
import '../../features/manga/styles/LocalReader.css';
import '../../features/reading/reading-hub.css';
import '../../features/books/BookLibrary.css';
import '../../features/books/ContentSourceExplorer.css';
import '../../features/books/BookDetail.css';
import '../../features/books/BookVolume.css';
import '../../features/books/BookReader.css';
export default async function SiteLayout({ children }: { children: ReactNode }) {
  const { settings } = await getSiteSettings();
  const music = await getJson<MusicTrack[]>(
    `${internalApiOrigin()}/api/music`,
    AbortSignal.timeout(10000),
  ).catch(() => []);
  return (
    <>
      <SiteFrame settings={settings} tracks={music.length ? music : settings.music_playlist || []}>
        {children}
      </SiteFrame>
      <SiteEffects />
    </>
  );
}
