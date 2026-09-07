export function MangaPanel() {
  return (
    <section id="manga-panel" className="admin-panel hidden">
      <div className="admin-subnav manga-domain-tabs" aria-label="漫画管理工作区">
        <button type="button" data-panel-tab="manga">
          漫画条目
        </button>
        <button type="button" data-panel-tab="search-sources">
          漫画源管理
        </button>
      </div>
      <section className="ryu-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black tracking-[.18em] text-primary">MANGA · WORKSPACE</p>
            <h2 className="mt-1 text-2xl font-black">漫画基础设置</h2>
            <p className="text-sm text-base-content/50">
              前台负责搜索、详情、章节阅读、书架和收藏；后台只维护已经登记的本地/兼容条目的状态和显示开关。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a className="ryu-btn" href="/manga" target="_blank">
              打开前台漫画站 ↗
            </a>
            <button data-panel-tab="search-sources" className="ryu-btn-primary" type="button">
              管理漫画源
            </button>
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-base-200/45 p-4">
            <span className="text-xs text-base-content/50">本地条目</span>
            <strong id="manga-local-count" className="mt-1 block text-2xl font-black">
              0
            </strong>
          </div>
          <div className="rounded-2xl bg-base-200/45 p-4">
            <span className="text-xs text-base-content/50">兼容网络条目</span>
            <strong id="manga-network-count" className="mt-1 block text-2xl font-black">
              0
            </strong>
          </div>
          <div className="rounded-2xl bg-base-200/45 p-4">
            <span className="text-xs text-base-content/50">前台可见</span>
            <strong id="manga-visible-count" className="mt-1 block text-2xl font-black">
              0
            </strong>
          </div>
        </div>
        <p className="mt-4 rounded-2xl border border-primary/15 bg-primary/5 p-4 text-sm text-base-content/65">
          网络漫画不需要先在这里建立条目：在前台选择源、搜索作品后即可打开详情、阅读、加入书架或收藏。Venera
          源仓库和自定义源统一在“漫画源管理”中维护。
        </p>
      </section>
      <section className="ryu-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-xl font-black">已登记条目</h3>
            <p className="text-sm text-base-content/50">
              仅保留基础状态、排序和前台显示设置；详细内容由前台源或本地内容流程提供。
            </p>
          </div>
        </div>
        <div id="manga-list" className="admin-personal-list mt-4"></div>
      </section>
    </section>
  );
}
