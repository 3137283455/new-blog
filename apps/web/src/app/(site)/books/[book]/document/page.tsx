import { notFound } from 'next/navigation';
import { BookDocumentPage } from '../../../../../features/books/book-document-page';
import { loadBook } from '../../../../../features/books/book-data';
import { pageMetadata } from '../../../../../shared/site/metadata';

export async function generateMetadata({ params }: { params: Promise<{ book: string }> }) {
  const { book: slug } = await params;
  const book = await loadBook(slug);
  return pageMetadata(book?.title || 'PDF 阅读', book?.description || 'PDF 文档阅读', `/books/${slug}/document`);
}

export default async function Page({ params }: { params: Promise<{ book: string }> }) {
  const book = await loadBook((await params).book);
  if (!book || book.reading_mode !== 'document' || String(book.source_format).toLowerCase() !== 'pdf' || !book.reading_url) notFound();
  return <BookDocumentPage book={book} />;
}
