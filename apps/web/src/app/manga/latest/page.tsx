import { MangaBrowsePage } from '../../../features/manga/components/browse-page';
import { pageMetadata } from '../../../shared/site/metadata';

export const generateMetadata = () =>
  pageMetadata('最新发现', '浏览漫画源的最新作品', '/manga/latest');

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  return (
    <MangaBrowsePage
      mode="latest"
      source={(Array.isArray(params.source) ? params.source[0] : params.source) || 'all'}
    />
  );
}
