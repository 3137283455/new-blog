import { MangaLibraryPage } from '../../../features/manga/components/library-page';
import { type LibraryItem } from '../../../features/manga/use-manga-library';
import { internalApiOrigin } from '../../../shared/site/settings';
import { getJson } from '../../../shared/http/json';
import { pageMetadata } from '../../../shared/site/metadata';

export const generateMetadata = () =>
  pageMetadata('漫画书架', '管理本地漫画与网络收藏', '/manga/library');
export default async function Page() {
  const items = await getJson<LibraryItem[]>(
    `${internalApiOrigin()}/api/manga`,
    AbortSignal.timeout(10000),
  ).catch(() => []);
  return <MangaLibraryPage initial={items} />;
}
