import { redirect } from 'next/navigation';
export default async function Page({ params }: { params: Promise<{ book: string }> }) {
  redirect(`/books/${encodeURIComponent((await params).book)}#contents`);
}
