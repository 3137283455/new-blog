import { notFound } from 'next/navigation';
import { loadLocalReader } from '../../../../../../features/manga/local-reader';
import { LocalReaderPage } from '../../../../../../features/manga/components/local-reader-page';
import { pageMetadata } from '../../../../../../shared/site/metadata';
const decode = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; volume: string; chapter: string }>;
}) {
  const p = await params,
    data = await loadLocalReader(decode(p.slug), decode(p.volume), decode(p.chapter));
  return pageMetadata(
    data?.chapter?.title || '漫画阅读',
    data?.manga?.title || '',
    `/manga/${p.slug}/${p.volume}/${p.chapter}`,
  );
}
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string; volume: string; chapter: string }>;
}) {
  const p = await params,
    data = await loadLocalReader(decode(p.slug), decode(p.volume), decode(p.chapter));
  if (!data?.chapter || !data?.manga) notFound();
  return <LocalReaderPage data={data} />;
}
