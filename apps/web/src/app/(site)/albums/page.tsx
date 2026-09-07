import { AlbumsPage } from '../../../features/site/public-pages';
import { loadAlbums } from '../../../features/site/site-data';
import { pageMetadata } from '../../../shared/site/metadata';
export const generateMetadata = () => pageMetadata('相册', '记录生活里的画面和回忆', '/albums');
export default async function Page() { return <AlbumsPage albums={await loadAlbums()} />; }
