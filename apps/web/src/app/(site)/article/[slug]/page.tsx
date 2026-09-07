import { notFound } from 'next/navigation';
import { ArticlePage } from '../../../../features/site/public-pages';
import { loadArticle } from '../../../../features/site/site-data';
export default async function Page({ params }: { params: Promise<{ slug: string }> }) { const data = await loadArticle((await params).slug); if (!data) notFound(); return <ArticlePage article={data} />; }
