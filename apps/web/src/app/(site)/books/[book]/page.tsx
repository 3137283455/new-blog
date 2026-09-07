import { notFound } from 'next/navigation';
import { BookDetailPage } from '../../../../features/books/book-detail-page';
import { loadBook, loadBookVolume } from '../../../../features/books/book-data';
import { pageMetadata } from '../../../../shared/site/metadata';

export async function generateMetadata({ params }: { params: Promise<{ book: string }> }) {
  const book = await loadBook((await params).book);
  return pageMetadata(book?.title || '书籍', book?.description || '书籍详情', `/books/${(await params).book}`);
}

export default async function Page({ params }: { params: Promise<{ book: string }> }) {
  const { book: raw } = await params;
  const book = await loadBook(raw);
  if (!book) notFound();
  const volumes = (await Promise.all((book.volumes || []).map((volume) => loadBookVolume(book.slug, volume.slug)))).map((item, index) => item?.volume || book.volumes?.[index]).filter(Boolean);
  return <BookDetailPage book={book} volumes={volumes} />;
}
