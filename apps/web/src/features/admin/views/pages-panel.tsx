export function PagesPanel() {
  return (
    <section id="pages-panel" className="admin-panel hidden">
      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <form id="page-form" className="ryu-card grid gap-4 p-5">
          <input type="hidden" name="id" />
          <div>
            <h2 id="page-editor-title" className="text-2xl font-black">
              新建独立页面
            </h2>
            <p className="text-sm text-base-content/50">
              可创建关于我、留言板、项目展示、免责声明等页面。
            </p>
          </div>
          <label className="form-control">
            <span className="label-text">标题</span>
            <input className="input input-bordered rounded-xl" name="title" required />
          </label>
          <label className="form-control">
            <span className="label-text">模板</span>
            <select className="select select-bordered rounded-xl" name="template">
              <option value="default">空白页面</option>
              <option value="about">关于我</option>
              <option value="guestbook">留言板</option>
              <option value="projects">项目展示</option>
              <option value="disclaimer">免责声明</option>
            </select>
          </label>
          <label className="form-control">
            <span className="label-text">状态</span>
            <select className="select select-bordered rounded-xl" name="status">
              <option value="published">发布</option>
              <option value="draft">草稿</option>
            </select>
          </label>
          <label className="form-control">
            <span className="label-text">Markdown 内容</span>
            <textarea
              className="textarea textarea-bordered min-h-64 rounded-xl font-mono text-sm"
              name="content"
            ></textarea>
          </label>
          <div className="flex gap-2">
            <button className="ryu-btn-primary" type="submit">
              保存页面
            </button>
            <button id="reset-page" className="ryu-btn" type="button">
              清空
            </button>
          </div>
          <p id="page-message" className="min-h-6 text-sm"></p>
        </form>
        <div className="ryu-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xl font-black">页面列表</h3>
            <div className="flex gap-2">
              <button id="pages-normal-mode" className="ryu-btn btn-sm" type="button">
                页面
              </button>
              <button id="pages-trash-mode" className="ryu-btn btn-sm" type="button">
                回收站
              </button>
            </div>
          </div>
          <div id="pages-list" className="mt-4 grid gap-3"></div>
        </div>
      </div>
    </section>
  );
}
