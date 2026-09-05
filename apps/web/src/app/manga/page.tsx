import { MangaHomePage } from '../../features/manga/components/home-page';
import type { MangaShelfItem } from '../../features/manga/contracts';
import { getJson } from '../../shared/http/json';
import { internalApiOrigin } from '../../shared/site/settings';
import { pageMetadata } from '../../shared/site/metadata';

export const generateMetadata = () =>
  pageMetadata('漫画站', '搜索、发现与阅读本地和网络漫画', '/manga');

export default async function Page() {
  const manga = await getJson<MangaShelfItem[]>(
    `${internalApiOrigin()}/api/manga`,
    AbortSignal.timeout(10000),
  ).catch(() => []);
  return <MangaHomePage manga={manga} />;
}
