import { HomePage } from '../../features/site/public-pages';
import { loadArticles, loadMusic, loadSeries, loadSettings } from '../../features/site/site-data';
import { pageMetadata } from '../../shared/site/metadata';
export const generateMetadata = () => pageMetadata('个人博客', '记录技术、生活与灵感的个人空间', '/');
export default async function Page() { const [articles, series, settings, tracks] = await Promise.all([loadArticles('?page=1&pageSize=10'), loadSeries(), loadSettings(), loadMusic()]); return <HomePage articles={articles} series={series.filter((item) => item.is_featured).slice(0, 3)} settings={settings} tracks={tracks} />; }
