import { ArchivePage } from '../../../features/site/public-pages';
import { loadArticles } from '../../../features/site/site-data';
import { pageMetadata } from '../../../shared/site/metadata';
export const generateMetadata = () => pageMetadata('归档', '按时间回看所有文章', '/archive');
export default async function Page({ searchParams }: { searchParams: Promise<{ category?: string }> }) { const category = (await searchParams).category || ''; const query = `?page=1&pageSize=100${category ? `&category=${encodeURIComponent(category)}` : ''}`; return <ArchivePage articles={await loadArticles(query)} category={category} />; }
