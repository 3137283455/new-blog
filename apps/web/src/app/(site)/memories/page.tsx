import { MemoriesPage } from '../../../features/site/public-pages';
import { loadMemories, loadSettings } from '../../../features/site/site-data';
import { pageMetadata } from '../../../shared/site/metadata';
export const generateMetadata = () => pageMetadata('个人回忆', '写作、照片与时间留下的长期记录', '/memories');
export default async function Page({ searchParams }: { searchParams: Promise<{ year?: string }> }) { const requested = Number((await searchParams).year) || new Date().getFullYear(); const [insights, settings] = await Promise.all([loadMemories(requested), loadSettings()]); return <MemoriesPage insights={insights} year={requested} settings={settings} />; }
