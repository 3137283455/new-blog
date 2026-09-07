import { SearchPage } from '../../../features/site/public-pages';
import { pageMetadata } from '../../../shared/site/metadata';
export const generateMetadata = () => pageMetadata('搜索', '搜索站内文章、书籍与漫画', '/search');
export default function Page() { return <SearchPage />; }
