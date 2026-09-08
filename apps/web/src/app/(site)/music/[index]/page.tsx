import { MusicPage } from '../../../../features/site/public-pages';
import { loadMusic, loadSettings } from '../../../../features/site/site-data';
import { pageMetadata } from '../../../../shared/site/metadata';
export const generateMetadata = () => pageMetadata('音乐', '博客音乐库', '/music');
export default async function Page({ params }: { params: Promise<{ index: string }> }) {
  const [{ index }, tracks, settings] = await Promise.all([params, loadMusic(), loadSettings()]);
  return <MusicPage tracks={tracks} index={Number(index) || 0} settings={settings} />;
}
