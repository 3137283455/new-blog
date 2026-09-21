import { notFound } from 'next/navigation';
import { loadBook, loadBookVolume } from '../../../../../features/books/book-data';
import { PdfBookReaderPage } from '../../../../../features/books/pdf-book-reader-page';
import { BookVolumePage } from '../../../../../features/books/book-volume-page';

export default async function Page({ params }: { params: Promise<{ book: string; volume: string }> }) {
  const { book, volume } = await params;
  if (volume === 'read') {
    const document = await loadBook(book);
    if (!document || document.reading_mode !== 'document' || String(document.source_format).toLowerCase() !== 'pdf' || !document.reading_url) notFound();
    return <PdfBookReaderPage book={document} />;
  }
  const data = await loadBookVolume(book, volume);
  if (!data) notFound();
  return <BookVolumePage book={data.book} volume={data.volume} />;
}
