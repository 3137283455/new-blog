export function SeriesPanel() {
  return (
    <section id="series-panel" className="admin-panel hidden">
      <section className="mt-5 grid gap-4">
        <header className="flex flex-wrap items-end justify-between gap-3 px-1">
          <div>
            <p className="text-xs font-black tracking-[0.18em] text-primary">CONTENT COLLECTIONS</p>
            <h2 className="mt-1 text-2xl font-black">专题与系列</h2>
            <p className="text-sm text-base-content/50">
              把多篇文章组织成一本专题，并设置阅读顺序。
            </p>
          </div>
          <a className="ryu-btn btn-sm" href="/series" target="_blank">
            查看前台专题 ↗
          </a>
        </header>
        <div className="admin-personal-columns">
          <form id="personal-series-form" className="ryu-card grid gap-3 p-5">
            <div>
              <h3 className="text-xl font-black">专题信息</h3>
              <p className="text-sm text-base-content/50">先创建专题，再从文章库中编排内容。</p>
            </div>
            <input name="id" type="hidden" />
            <input
              className="input input-bordered rounded-xl"
              name="title"
              maxLength={100}
              placeholder="专题标题"
              required
            />
            <input
              className="input input-bordered rounded-xl"
              name="slug"
              maxLength={120}
              placeholder="URL 标识（可留空）"
            />
            <input
              className="input input-bordered rounded-xl"
              name="cover"
              maxLength={500}
              placeholder="专题封面地址"
            />
            <div className="grid grid-cols-2 gap-3">
              <select className="select select-bordered rounded-xl" name="series_type">
                <option value="article">文章专题</option>
                <option value="book">小说书籍</option>
                <option value="project">项目时间线</option>
              </select>
              <input
                className="input input-bordered rounded-xl"
                name="book_id"
                type="number"
                min="1"
                placeholder="关联书籍 ID（小说可选）"
              />
            </div>
            <textarea
              className="textarea textarea-bordered min-h-28 rounded-xl"
              name="description"
              maxLength={1000}
              placeholder="专题介绍"
            ></textarea>
            <div className="grid grid-cols-2 gap-3">
              <input
                className="input input-bordered rounded-xl"
                name="sort_order"
                type="number"
                placeholder="排序"
              />
              <select className="select select-bordered rounded-xl" name="status">
                <option value="published">公开</option>
                <option value="draft">草稿</option>
              </select>
            </div>
            <label className="label cursor-pointer justify-start gap-2">
              <input className="checkbox checkbox-sm" name="is_featured" type="checkbox" />
              首页展示这个专题
            </label>
            <div className="flex gap-2">
              <button className="ryu-btn-primary" type="submit">
                保存专题
              </button>
              <button id="personal-series-reset" className="ryu-btn" type="button">
                新建
              </button>
            </div>
          </form>
          <section className="ryu-card p-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black">专题列表</h3>
                <p className="text-sm text-base-content/50">选择“编辑”后即可添加文章。</p>
              </div>
            </div>
            <div id="personal-series-list" className="admin-personal-list mt-4"></div>
          </section>
        </div>
        <section className="ryu-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-black">文章编排</h3>
              <p id="personal-series-articles-hint" className="text-sm text-base-content/50">
                请先新建或选择一个专题。
              </p>
            </div>
            <button
              id="personal-series-articles-save"
              className="ryu-btn-primary btn-sm"
              type="button"
              disabled
            >
              保存文章顺序
            </button>
          </div>
          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <div className="rounded-2xl border border-base-content/10 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="font-black">文章库</h4>
                <input
                  id="personal-series-article-search"
                  className="input input-bordered input-sm w-full rounded-xl sm:w-64"
                  type="search"
                  placeholder="搜索文章标题"
                />
              </div>
              <div
                id="personal-series-article-options"
                className="admin-series-article-list mt-3"
              ></div>
            </div>
            <div className="rounded-2xl border border-base-content/10 p-4">
              <div className="flex items-center justify-between gap-2">
                <h4 className="font-black">已选文章</h4>
                <span id="personal-series-article-count" className="badge badge-outline">
                  0 篇
                </span>
              </div>
              <p className="mt-1 text-xs text-base-content/45">
                从上到下即前台阅读顺序，可上下调整或移除。
              </p>
              <div
                id="personal-series-article-selected"
                className="admin-series-article-list mt-3"
              ></div>
            </div>
          </div>
        </section>
      </section>
    </section>
  );
}
