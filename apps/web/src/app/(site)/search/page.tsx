import { SearchPage } from '../../../features/site/public-pages';
import { loadSettings } from '../../../features/site/site-data';
import { pageMetadata } from '../../../shared/site/metadata';
export const generateMetadata = () => pageMetadata('搜索', '搜索站内文章、书籍与漫画', '/search');
export default async function Page() { return <SearchPage settings={await loadSettings()} />; }
