import { redirect } from 'next/navigation';
import { SourceDetailPage } from '../../../../../features/manga/components/source-detail-page';
import { loadSourceDetail, type SourceKind } from '../../../../../features/manga/source-detail';
import { pageMetadata } from '../../../../../shared/site/metadata';

type Props = { params: Promise<{ kind: string; source: string; id: string }> };
const decode = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};
export async function generateMetadata({ params }: Props) {
  const raw = await params;
  const { kind } = raw,
    source = decode(raw.source),
    id = decode(raw.id);
  const data = await loadSourceDetail(kind, source, id);
  return pageMetadata(
    data?.item?.title || '源站详情',
    `${data?.source?.label || source} · 源站详情`,
    `/source/${encodeURIComponent(kind)}/${encodeURIComponent(source)}/${encodeURIComponent(id)}`,
  );
}
export default async function Page({ params }: Props) {
  const raw = await params;
  const { kind } = raw,
    source = decode(raw.source),
    id = decode(raw.id);
  const data = await loadSourceDetail(kind, source, id);
  if (!data?.item) redirect('/404');
  return <SourceDetailPage kind={kind as SourceKind} source={source} id={id} data={data} />;
}
