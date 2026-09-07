import { notFound } from 'next/navigation';
import { SeriesDetailPage } from '../../../../features/site/public-pages';
import { loadSeriesDetail } from '../../../../features/site/site-data';
export default async function Page({ params }: { params: Promise<{ slug: string }> }) { const data = await loadSeriesDetail((await params).slug); if (!data) notFound(); return <SeriesDetailPage series={data} />; }
