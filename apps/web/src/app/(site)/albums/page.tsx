import { AlbumsPage } from '../../../features/site/public-pages';
import { loadAlbums, loadMusic, loadSettings } from '../../../features/site/site-data';
import { pageMetadata } from '../../../shared/site/metadata';
export const generateMetadata = () => pageMetadata('相册', '记录生活里的画面和回忆', '/albums');
export default async function Page() { const [albums, settings, tracks] = await Promise.all([loadAlbums(), loadSettings(), loadMusic()]); return <AlbumsPage albums={albums} settings={settings} tracks={tracks} />; }
