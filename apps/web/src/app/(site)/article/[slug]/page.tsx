import { notFound } from 'next/navigation';
import { ArticlePage } from '../../../../features/site/public-pages';
import { loadArticle, loadSettings } from '../../../../features/site/site-data';
export default async function Page({ params }: { params: Promise<{ slug: string }> }) { const [data, settings] = await Promise.all([loadArticle((await params).slug), loadSettings()]); if (!data) notFound(); return <ArticlePage article={data} settings={settings} />; }
