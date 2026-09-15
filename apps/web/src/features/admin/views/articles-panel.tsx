export function ArticlesPanel() {
  return (
    <section id="articles-panel" className="admin-panel hidden">
      <div className="ryu-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-black">文章管理</h2>
            <p className="text-sm text-base-content/50">管理发布状态、草稿与回收站。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              id="status-filter"
              aria-label="文章状态"
              className="select select-bordered select-sm rounded-xl"
            >
              <option value="">全部状态</option>
              <option value="published">已发布</option>
              <option value="draft">草稿</option>
            </select>
            <label className="label cursor-pointer justify-start gap-2 rounded-xl bg-base-100/60 px-3 py-1">
              <input id="trash-filter" className="checkbox checkbox-sm" type="checkbox" />
              回收站
            </label>
            <button id="batch-delete" className="ryu-btn btn-sm">
              批量删除
            </button>
            <a id="new-article" className="ryu-btn-primary btn-sm" href="/admin/write/editor">
              新建文章
            </a>
          </div>
        </div>
        <div className="mt-5 overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>
                  <input
                    id="select-all-articles"
                    aria-label="选择全部文章"
                    className="checkbox checkbox-sm"
                    type="checkbox"
                  />
                </th>
                <th>标题</th>
                <th>状态</th>
                <th>分类</th>
                <th>阅读</th>
                <th>更新时间</th>
                <th className="text-right">操作</th>
              </tr>
            </thead>
            <tbody id="articles-table"></tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
