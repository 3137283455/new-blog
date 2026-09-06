import { notFound, redirect } from 'next/navigation';
import { loadSourceReader } from '../../../../../../features/manga/source-reader';
import { SourceReaderPage } from '../../../../../../features/manga/components/source-reader-page';
import type { SourceKind } from '../../../../../../features/manga/source-detail';
import { pageMetadata } from '../../../../../../shared/site/metadata';
const decode = (s: string) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};
export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ kind: SourceKind; source: string; chapter: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const p = await params,
    q = await searchParams;
  if (!['manga', 'book', 'bangumi'].includes(p.kind) || typeof q.id !== 'string') return {};
  const data = await loadSourceReader(p.kind, decode(p.source), q.id, decode(p.chapter));
  return pageMetadata(
    (typeof q.title === 'string' ? q.title : '') || data?.reader?.title || '漫画阅读',
    `${data?.source?.label || decode(p.source)} · 源阅读`,
    `/source/${p.kind}/${p.source}/chapter/${p.chapter}`,
  );
}
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ kind: SourceKind; source: string; chapter: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await params,
    q = await searchParams;
  const source = decode(raw.source),
    chapter = decode(raw.chapter),
    kind = raw.kind;
  const id = typeof q.id === 'string' ? q.id : '',
    title = typeof q.title === 'string' ? q.title : '';
  if (!['manga', 'book', 'bangumi'].includes(kind) || !id) notFound();
  const data = await loadSourceReader(kind, source, id, chapter);
  if (!data?.reader) notFound();
  const reader = { ...data.reader, title: title || data.reader.title || '漫画阅读' };
  if (reader.chapter_id && reader.chapter_id !== chapter)
    redirect(
      `/source/${encodeURIComponent(kind)}/${encodeURIComponent(source)}/chapter/${encodeURIComponent(reader.chapter_id)}?id=${encodeURIComponent(id)}&title=${encodeURIComponent(reader.chapter_title || reader.title || '')}`,
    );
  return (
    <SourceReaderPage
      kind={kind}
      source={source}
      chapterId={chapter}
      workId={id}
      reader={reader}
      sourceLabel={data.source?.label || source}
    />
  );
}
