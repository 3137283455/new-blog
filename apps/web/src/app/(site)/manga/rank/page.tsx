import { MangaSiteHeader } from '../../../../features/manga/components/site-header';
import { pageMetadata } from '../../../../shared/site/metadata';
export const generateMetadata = () => pageMetadata('漫画排行', '漫画源排行榜', '/manga/rank');
export default function Page() {
  return (
    <>
      <main className="manga-rank-page manga-redesign">
        <MangaSiteHeader active="rank" backHref="/manga" />
        <div className="manga-rank-layout">
          <aside className="manga-context-rail manga-rank-context" aria-label="漫画排行导航">
            <div className="manga-context-intro">
              <p>CURATED RANKING</p>
              <h2>排行<br />索引</h2>
              <span>不同来源各有自己的口径，先把入口整理好。</span>
            </div>
            <nav className="manga-context-nav" aria-label="漫画站页面">
              <a href="/manga"><span>01</span>发现</a>
              <a href="/manga/latest"><span>02</span>最新</a>
              <a className="is-active" href="/manga/rank"><span>03</span>排行</a>
              <a href="/manga/library"><span>04</span>书架</a>
            </nav>
            <section className="manga-context-status">
              <p>WHY NO GLOBAL LIST</p>
              <span>漫画源的榜单接口、时间范围和评分体系并不统一，因此不合并成一个看似准确的榜单。</span>
            </section>
            <a className="manga-context-footer" href="/manga/latest">
              <span>浏览最新</span><small>去发现作品 ↗</small>
            </a>
          </aside>
          <section className="manga-rank-empty">
            <div className="rank-signal" aria-hidden="true"><span>03</span><i></i><i></i><i></i></div>
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
        </div>
      </main>
    </>
  );
}
