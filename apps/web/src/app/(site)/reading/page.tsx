import { ReadingHub } from '../../../features/reading/reading-hub';
import { pageMetadata } from '../../../shared/site/metadata';
export const generateMetadata = () =>
  pageMetadata('阅读中心', '小说与漫画的统一阅读记录', '/reading');
export default function Page() {
  return <ReadingHub />;
}
