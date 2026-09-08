import { SeriesPage } from '../../../features/site/public-pages';
import { loadSeries, loadSettings } from '../../../features/site/site-data';
import { pageMetadata } from '../../../shared/site/metadata';
export const generateMetadata = () => pageMetadata('文章专题', '把持续记录的项目与兴趣整理成册', '/series');
export default async function Page() { const [series, settings] = await Promise.all([loadSeries(), loadSettings()]); return <SeriesPage series={series} settings={settings} />; }
