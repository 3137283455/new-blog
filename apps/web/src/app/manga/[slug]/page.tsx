import { notFound } from 'next/navigation';
import { loadLocalManga } from '../../../features/manga/local-detail';
import { LocalDetailPage } from '../../../features/manga/components/local-detail-page';
const decode = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const item = await loadLocalManga(decode((await params).slug));
  return { title: item?.title || '漫画详情' };
}
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const item = await loadLocalManga(decode((await params).slug));
  if (!item?.id) notFound();
  return <LocalDetailPage item={item} />;
}
