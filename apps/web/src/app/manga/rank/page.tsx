import { MangaSiteHeader } from '../../../features/manga/components/site-header';
import { pageMetadata } from '../../../shared/site/metadata';
export const generateMetadata = () => pageMetadata('漫画排行', '漫画源排行榜', '/manga/rank');
export default function Page() {
  return (
    <>
      <main className="manga-rank-page">
        <MangaSiteHeader active="rank" />
        <section className="manga-rank-empty">
          <p>RANKING IS SOURCE-DEPENDENT</p>
          <h1>排行榜正在准备中。</h1>
          <span>
            不同漫画源的排行口径并不一致，暂不拼接虚假榜单。你可以先按来源浏览最新作品，或直接搜索想看的漫画。
          </span>
          <div>
            <a href="/manga/latest">浏览最新发现 →</a>
            <a href="/manga/search">搜索漫画 →</a>
          </div>
        </section>
      </main>
    </>
  );
}
