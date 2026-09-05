import { MangaBrowsePage } from '../../../features/manga/components/browse-page';
import { pageMetadata } from '../../../shared/site/metadata';

export const generateMetadata = () => pageMetadata('搜索漫画', '从漫画源搜索作品', '/manga/search');

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  return (
    <MangaBrowsePage
      mode="search"
      query={first(params.q) || ''}
      source={first(params.source) || 'all'}
    />
  );
}
