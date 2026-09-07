import { MusicPage } from '../../../../features/site/public-pages';
import { loadMusic } from '../../../../features/site/site-data';
import { pageMetadata } from '../../../../shared/site/metadata';
export const generateMetadata = () => pageMetadata('音乐', '博客音乐库', '/music');
export default async function Page() { return <MusicPage tracks={await loadMusic()} />; }
