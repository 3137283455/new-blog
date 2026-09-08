import { notFound } from 'next/navigation';
import { SeriesDetailPage } from '../../../../features/site/public-pages';
import { loadSeriesDetail, loadSettings } from '../../../../features/site/site-data';
export default async function Page({ params }: { params: Promise<{ slug: string }> }) { const [data, settings] = await Promise.all([loadSeriesDetail((await params).slug), loadSettings()]); if (!data) notFound(); return <SeriesDetailPage series={data} settings={settings} />; }
