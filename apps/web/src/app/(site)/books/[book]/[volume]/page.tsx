import { notFound } from 'next/navigation';
import { loadBookVolume } from '../../../../../features/books/book-data';
import { BookVolumePage } from '../../../../../features/books/book-volume-page';

export default async function Page({ params }: { params: Promise<{ book: string; volume: string }> }) {
  const { book, volume } = await params;
  const data = await loadBookVolume(book, volume);
  if (!data) notFound();
  return <BookVolumePage book={data.book} volume={data.volume} />;
}
