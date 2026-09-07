import { NavigationPage } from '../../../features/site/public-pages';
import { loadNavigation } from '../../../features/site/site-data';
import { pageMetadata } from '../../../shared/site/metadata';
export const generateMetadata = () => pageMetadata('导航', '你的每日网络起点', '/nav');
export default async function Page() { return <NavigationPage links={await loadNavigation()} />; }
