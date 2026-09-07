import { notFound } from 'next/navigation';
import { PageContent } from '../../../../features/site/public-pages';
import { loadPage } from '../../../../features/site/site-data';
export default async function Page({ params }: { params: Promise<{ slug: string }> }) { const data = await loadPage((await params).slug); if (!data) notFound(); return <PageContent page={data} />; }
