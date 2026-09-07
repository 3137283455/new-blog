import { BangumiPage } from '../../../features/site/public-pages';
import { loadBangumi } from '../../../features/site/site-data';
import { pageMetadata } from '../../../shared/site/metadata';
export const generateMetadata = () => pageMetadata('追番', '记录正在看的番剧和喜欢的作品', '/bangumi');
export default async function Page() { return <BangumiPage items={await loadBangumi()} />; }
