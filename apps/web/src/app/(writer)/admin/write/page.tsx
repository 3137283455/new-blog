import { redirect } from 'next/navigation';
import { WritingWorkspace } from '../../../../features/writer/workspace-page';
import '../../../../features/writer/workspace.css';
export const metadata = { title: '写作台' };
export default async function Page({ searchParams }: { searchParams: Promise<{id?: string}> }) {
  const params = await searchParams;
  if (params.id) redirect('/admin/write/editor?id=' + encodeURIComponent(params.id));
  return <WritingWorkspace />;
}
