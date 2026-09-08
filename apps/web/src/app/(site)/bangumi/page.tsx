import { BangumiPage } from '../../../features/site/public-pages';
import { loadBangumi, loadSettings } from '../../../features/site/site-data';
import { pageMetadata } from '../../../shared/site/metadata';
export const generateMetadata = () =>
  pageMetadata('追番', '记录正在看的番剧和喜欢的作品', '/bangumi');
export default async function Page() {
  const [items, settings] = await Promise.all([loadBangumi(), loadSettings()]);
  return <BangumiPage items={items} settings={settings} />;
}
