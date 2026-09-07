export function SearchSourcesPanel() {
  return (
    <section
      id="search-sources-panel"
      className="admin-panel hidden space-y-5"
      aria-labelledby="content-search-sources-title"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black tracking-[.18em] text-primary">MANGA · SOURCES</p>
          <h2 id="content-search-sources-title" className="mt-1 text-2xl font-black">
            漫画源管理
          </h2>
          <p className="text-sm text-base-content/50">
            这里仅管理漫画源。同步 Venera
            源仓库后，前台即可搜索、打开详情并阅读；本页不再编辑复杂的源脚本。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button data-panel-tab="manga" className="ryu-btn" type="button">
            返回漫画管理
          </button>
          <label className="ryu-btn cursor-pointer">
            导入源文件
            <input
              id="search-source-import"
              className="hidden"
              type="file"
              accept="application/json,.json"
              multiple
            />
          </label>
          <button id="search-source-export-all" className="ryu-btn" type="button">
            导出全部源
          </button>
        </div>
      </div>
      <section className="ryu-card grid gap-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-black">Venera 源仓库</h3>
            <p className="text-sm text-base-content/50">
              同步 Venera 的仓库索引后，前台漫画站即可直接选择这些源进行搜索、查看目录和阅读。
            </p>
          </div>
          <span id="venera-repository-badge" className="badge badge-ghost">
            尚未同步
          </span>
        </div>
        <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto]">
          <input
            id="venera-repository-url"
            className="input input-bordered w-full rounded-xl font-mono text-xs"
            defaultValue="https://cdn.jsdelivr.net/gh/venera-app/venera-configs@main/index.json"
            aria-label="Venera 仓库索引地址"
          />
          <button id="venera-repository-import" className="ryu-btn-primary" type="button">
            同步仓库
          </button>
        </div>
        <div id="venera-repository-list" className="grid gap-2"></div>
        <div className="grid gap-2 border-t border-base-content/10 pt-4 lg:grid-cols-[minmax(12rem,.8fr)_minmax(12rem,1fr)_auto]">
          <select
            id="venera-source-test-select"
            className="select select-bordered rounded-xl"
            aria-label="选择 Venera 源"
          ></select>
          <input
            id="venera-source-test-query"
            className="input input-bordered rounded-xl"
            defaultValue="海贼王"
            placeholder="测试搜索关键词"
          />
          <button id="venera-source-test" className="ryu-btn" type="button">
            测试源
          </button>
        </div>
        <div
          id="venera-source-test-results"
          className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4"
        ></div>
        <p id="venera-repository-status" className="min-h-5 text-sm" aria-live="polite"></p>
      </section>
      <section className="ryu-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-black">其他漫画源</h3>
            <p className="text-sm text-base-content/50">
              这里显示旧版单接口漫画源；支持导入、导出、启停和删除。Venera 源统一在上方仓库管理。
            </p>
          </div>
          <span className="badge badge-ghost">仅漫画</span>
        </div>
        <div
          id="content-search-source-list"
          className="mt-4 grid divide-y divide-base-content/10"
        ></div>
      </section>
      <p
        id="content-search-source-message"
        className="min-h-6 whitespace-pre-line text-sm"
        aria-live="polite"
      ></p>
    </section>
  );
}
