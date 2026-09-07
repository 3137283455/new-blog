import { notFound } from 'next/navigation';
import { loadBookChapter } from '../../../../../../features/books/book-data';
import { BookReaderPage } from '../../../../../../features/books/book-reader-page';
import { pageMetadata } from '../../../../../../shared/site/metadata';

export async function generateMetadata({ params }: { params: Promise<{ book: string; volume: string; chapter: string }> }) {
  const { book, volume, chapter } = await params;
  const data = await loadBookChapter(book, volume, chapter);
  return pageMetadata(data?.chapter.title || '章节阅读', data?.book.title || '书籍阅读', `/books/${book}/${volume}/${chapter}`);
}

export default async function Page({ params, searchParams }: { params: Promise<{ book: string; volume: string; chapter: string }>; searchParams: Promise<{ at?: string }> }) {
  const { book, volume, chapter } = await params;
  const data = await loadBookChapter(book, volume, chapter);
  if (!data) notFound();
  const at = Number((await searchParams).at);
  return <BookReaderPage data={data} requestedPosition={Number.isFinite(at) ? at : null} />;
}
