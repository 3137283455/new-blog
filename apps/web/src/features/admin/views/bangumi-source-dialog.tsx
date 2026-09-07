export function BangumiSourceDialog() {
  return (
    <dialog id="bangumi-source-dialog" className="admin-media-picker bangumi-source-dialog">
      <div className="admin-media-picker-panel bangumi-source-dialog-panel">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-xl font-black">检索番剧</h3>
          </div>
          <button
            id="bangumi-source-close"
            className="admin-dialog-close"
            type="button"
            aria-label="关闭"
            title="关闭"
          >
            &times;
          </button>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
          <input
            id="bangumi-source-query"
            className="input input-bordered rounded-xl"
            type="search"
            placeholder="输入番剧名称或 Bangumi ID"
          />
          <button id="bangumi-source-search" className="ryu-btn-primary" type="button">
            开始检索
          </button>
        </div>
        <div id="bangumi-source-results" className="bangumi-source-results mt-4"></div>
        <div
          id="bangumi-source-pagination"
          className="mt-4 hidden items-center justify-between gap-3 border-t border-base-content/10 pt-4"
        >
          <button id="bangumi-source-prev" className="btn btn-sm rounded-xl" type="button">
            上一页
          </button>
          <span id="bangumi-source-page" className="text-sm font-bold text-base-content/60">
            第 1 / 1 页
          </span>
          <button id="bangumi-source-next" className="btn btn-sm rounded-xl" type="button">
            下一页
          </button>
        </div>
      </div>
    </dialog>
  );
}
