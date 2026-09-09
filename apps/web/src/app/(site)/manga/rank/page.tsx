import { pageMetadata } from '../../../../shared/site/metadata';
export const generateMetadata = () => pageMetadata('漫画排行', '漫画源排行榜', '/manga/rank');
export default function Page() {
  return (
    <>
      <main className="manga-rank-page manga-redesign">
        <div className="manga-rank-layout">
          <aside className="manga-context-rail manga-rank-context" aria-label="漫画排行导航">
            <nav className="manga-context-nav" aria-label="漫画站页面">
              <a href="/manga">
                <span>01</span>发现
              </a>
              <a href="/manga/latest">
                <span>02</span>最新
              </a>
              <a className="is-active" href="/manga/rank">
                <span>03</span>排行
              </a>
              <a href="/manga/library">
                <span>04</span>书架
              </a>
            </nav>
            <section className="manga-context-status">
              <p>关于排行</p>
              <span>榜单由漫画来源提供。</span>
            </section>
            <a className="manga-context-footer" href="/manga/latest">
              <span>浏览最新</span>
              <small>去发现作品 ↗</small>
            </a>
          </aside>
          <section className="manga-rank-content">
            <h1>漫画排行</h1>
            <div className="manga-rank-empty">
              <h2>暂无可用榜单</h2>
              <span>可以先浏览最新漫画，或搜索想看的作品。</span>
              <div>
                <a href="/manga/latest">浏览最新发现 →</a>
                <a href="/manga/search">搜索漫画 →</a>
              </div>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
