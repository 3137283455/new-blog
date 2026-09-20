import { BookLibrary } from '../../../features/books/book-library';
import type { BookSummary } from '../../../features/books/contracts';
import { getJson } from '../../../shared/http/json';
import { internalApiOrigin } from '../../../shared/site/settings';
import { pageMetadata } from '../../../shared/site/metadata';

export const generateMetadata = () => pageMetadata('书库', '小说、分卷与长期阅读', '/books');

export default async function Page() {
  const books = await getJson<BookSummary[]>(`${internalApiOrigin()}/api/books`, AbortSignal.timeout(10000)).catch(() => []);
  return <BookLibrary books={books} />;
}
