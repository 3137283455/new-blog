import { notFound } from 'next/navigation';
import { AlbumDetailPage } from '../../../../features/site/public-pages';
import { loadAlbum } from '../../../../features/site/site-data';
export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ group?: string }> }) { const { id } = await params; const album = await loadAlbum(id); if (!album) notFound(); return <AlbumDetailPage album={album} group={(await searchParams).group === 'location' ? 'location' : 'year'} />; }
