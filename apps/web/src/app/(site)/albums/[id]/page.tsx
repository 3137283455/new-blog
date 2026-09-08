import { notFound } from 'next/navigation';
import { AlbumDetailPage } from '../../../../features/site/public-pages';
import { loadAlbum, loadSettings } from '../../../../features/site/site-data';
export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ group?: string }> }) { const { id } = await params; const [album, settings] = await Promise.all([loadAlbum(id), loadSettings()]); if (!album) notFound(); return <AlbumDetailPage album={album} group={(await searchParams).group === 'location' ? 'location' : 'year'} settings={settings} />; }
