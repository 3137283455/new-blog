import { SeriesPage } from '../../../features/site/public-pages';
import { loadSeries } from '../../../features/site/site-data';
import { pageMetadata } from '../../../shared/site/metadata';
export const generateMetadata = () => pageMetadata('文章专题', '把持续记录的项目与兴趣整理成册', '/series');
export default async function Page() { return <SeriesPage series={await loadSeries()} />; }
