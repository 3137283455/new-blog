import { notFound } from 'next/navigation';
import { PageContent } from '../../../../features/site/public-pages';
import { loadPage, loadSettings } from '../../../../features/site/site-data';
export default async function Page({ params }: { params: Promise<{ slug: string }> }) { const [data, settings] = await Promise.all([loadPage((await params).slug), loadSettings()]); if (!data) notFound(); return <PageContent page={data} settings={settings} />; }
