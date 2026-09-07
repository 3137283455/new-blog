export function EditorPanel() {
  return (
    <section id="editor-panel" className="admin-panel hidden">
      <form id="article-form" className="ryu-card grid gap-5 p-5">
        <input type="hidden" name="id" />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="editor-title" className="text-2xl font-black">
              新建文章
            </h2>
            <p className="text-sm text-base-content/50">
              Markdown 内容会由后端渲染为 HTML 并写入数据库。
            </p>
          </div>
          <div className="flex gap-2">
            <button className="ryu-btn btn-sm" type="button" id="reset-editor">
              清空
            </button>
            <button className="ryu-btn-primary btn-sm" type="submit">
              保存文章
            </button>
          </div>
        </div>
        <label className="form-control">
          <span className="label-text">标题</span>
          <input className="input input-bordered rounded-xl" name="title" required />
        </label>
        <div className="grid gap-4 lg:grid-cols-3">
          <label className="form-control">
            <span className="label-text">状态</span>
            <select className="select select-bordered rounded-xl" name="status">
              <option value="draft">草稿</option>
              <option value="published">发布</option>
            </select>
          </label>
          <label className="form-control">
            <span className="label-text">可见性</span>
            <select className="select select-bordered rounded-xl" name="visibility">
              <option value="public">公开</option>
              <option value="private">私密</option>
            </select>
          </label>
          <label className="form-control">
            <span className="label-text">分类</span>
            <select
              id="category-select"
              className="select select-bordered rounded-xl"
              name="category_id"
            >
              <option value="">无分类</option>
            </select>
          </label>
        </div>
        <label className="form-control">
          <span className="label-text">标签</span>
          <select
            id="tag-select"
            className="select select-bordered min-h-28 rounded-xl"
            name="tag_ids"
            multiple
          ></select>
        </label>
        <div className="ryu-card grid gap-4 p-4">
          <div>
            <h3 className="text-lg font-black">文章字体</h3>
            <p className="text-sm text-base-content/50">
              从独立字体库选择标题和正文；字体导入请到侧边栏「字体库」。
            </p>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            <label className="form-control">
              <span className="label-text">标题字体</span>
              <select
                id="title-font-select"
                className="select select-bordered rounded-xl"
                name="title_font_key"
              ></select>
            </label>
            <label className="form-control">
              <span className="label-text">正文字体</span>
              <select
                id="body-font-select"
                className="select select-bordered rounded-xl"
                name="body_font_key"
              ></select>
            </label>
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <label className="form-control">
            <span className="label-text">摘要</span>
            <textarea
              className="textarea textarea-bordered min-h-28 rounded-xl"
              name="excerpt"
            ></textarea>
          </label>
          <label className="form-control">
            <span className="label-text">封面图地址</span>
            <div className="join w-full">
              <input
                className="input join-item input-bordered w-full rounded-l-xl"
                name="cover_image"
                placeholder="/image1.webp 或 /uploads/..."
              />
              <button
                className="btn join-item"
                type="button"
                data-pick-media
                data-target-form="article-form"
                data-target-field="cover_image"
                data-media-type="image"
              >
                选择
              </button>
              <label className="btn join-item rounded-r-xl">
                上传
                <input id="cover-upload" className="hidden" type="file" accept="image/*" />
              </label>
            </div>
            <div
              id="cover-preview"
              className="mt-3 hidden overflow-hidden rounded-xl border border-base-content/10 bg-base-200"
            ></div>
            <div className="mt-3 flex gap-4">
              <label className="label cursor-pointer justify-start gap-2">
                <input className="checkbox checkbox-sm" type="checkbox" name="is_pinned" />
                置顶
              </label>
              <label className="label cursor-pointer justify-start gap-2">
                <input className="checkbox checkbox-sm" type="checkbox" name="is_recommended" />
                推荐
              </label>
            </div>
          </label>
        </div>
        <label className="form-control">
          <span className="label-text">正文 Markdown</span>
          <div className="my-2 flex flex-wrap gap-2" id="markdown-toolbar">
            <button className="btn btn-xs rounded-lg" type="button" data-md-insert="heading">
              标题
            </button>
            <button className="btn btn-xs rounded-lg" type="button" data-md-insert="bold">
              加粗
            </button>
            <button className="btn btn-xs rounded-lg" type="button" data-md-insert="quote">
              引用
            </button>
            <button className="btn btn-xs rounded-lg" type="button" data-md-insert="code">
              代码块
            </button>
            <button className="btn btn-xs rounded-lg" type="button" data-md-insert="table">
              表格
            </button>
            <button className="btn btn-xs rounded-lg" type="button" data-md-insert="image">
              图片
            </button>
            <button className="btn btn-xs rounded-lg" type="button" data-md-insert="math">
              公式
            </button>
            <button className="btn btn-xs rounded-lg" type="button" data-md-insert="footnote">
              脚注
            </button>
          </div>
          <textarea
            className="textarea textarea-bordered min-h-[22rem] rounded-xl font-mono text-sm"
            name="content"
            required
          ></textarea>
        </label>
        <p id="editor-message" className="min-h-6 text-sm"></p>
      </form>
    </section>
  );
}
