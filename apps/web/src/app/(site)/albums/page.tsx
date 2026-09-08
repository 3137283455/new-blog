import { AlbumsPage } from '../../../features/site/public-pages';
import { loadAlbums, loadSettings } from '../../../features/site/site-data';
import { pageMetadata } from '../../../shared/site/metadata';
export const generateMetadata = () => pageMetadata('相册', '记录生活里的画面和回忆', '/albums');
export default async function Page() { const [albums, settings] = await Promise.all([loadAlbums(), loadSettings()]); return <AlbumsPage albums={albums} settings={settings} />; }
