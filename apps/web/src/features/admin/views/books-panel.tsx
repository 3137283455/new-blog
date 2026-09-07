export function BooksPanel() {
  return (
    <section id="books-panel" className="admin-panel hidden">
      <section className="grid gap-4">
        <header className="flex flex-wrap items-end justify-between gap-3 px-1">
          <div>
            <p className="text-xs font-black tracking-[0.18em] text-primary">PERSONAL LIBRARY</p>
            <h2 className="mt-1 text-2xl font-black">书库与 EPUB</h2>
            <p className="text-sm text-base-content/50">
              小说与普通文章分开管理。先预览结构，确认分卷和章节后再写入。
            </p>
          </div>
          <a className="ryu-btn btn-sm" href="/books" target="_blank">
            查看前台书库 ↗
          </a>
        </header>
        <div className="grid gap-4 xl:grid-cols-[1.05fr_.95fr]">
          <section className="ryu-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-xl font-black">导入本地图书</h3>
                <p className="text-sm text-base-content/50">
                  EPUB、TXT、Markdown 会解析为章节；PDF 保留原版式并作为文档阅读。
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <label className="ryu-btn-primary btn-sm">
                  EPUB
                  <input
                    id="book-epub-files"
                    className="hidden"
                    type="file"
                    accept=".epub,application/epub+zip"
                    multiple
                  />
                </label>
                <label className="ryu-btn btn-sm">
                  TXT / Markdown
                  <input
                    id="book-text-files"
                    className="hidden"
                    type="file"
                    accept=".txt,.md,.markdown,text/plain,text/markdown"
                    multiple
                  />
                </label>
                <label className="ryu-btn btn-sm">
                  PDF
                  <input
                    id="book-pdf-file"
                    className="hidden"
                    type="file"
                    accept=".pdf,application/pdf"
                  />
                </label>
              </div>
            </div>
            <div id="book-import-preview" className="mt-4">
              <p className="text-sm text-base-content/45">选择文件后会先解析，不会立即写入书库。</p>
            </div>
          </section>
          <section className="ryu-card p-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black">书籍列表</h3>
                <p className="text-sm text-base-content/50">书籍删除后进入回收站。</p>
              </div>
              <button id="book-new" className="ryu-btn btn-sm" type="button">
                新建空书
              </button>
            </div>
            <div id="admin-book-list" className="admin-personal-list mt-4"></div>
          </section>
        </div>
        <section id="book-editor-card" className="ryu-card hidden p-5">
          <form id="book-form" className="grid gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-black">书籍信息</h3>
              <button id="book-editor-close" type="button">
                ×
              </button>
            </div>
            <input name="id" type="hidden" />
            <div className="grid gap-3 md:grid-cols-2">
              <input
                className="input input-bordered rounded-xl"
                name="title"
                placeholder="书名"
                required
              />
              <input className="input input-bordered rounded-xl" name="author" placeholder="作者" />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <input
                className="input input-bordered rounded-xl"
                name="slug"
                placeholder="URL 标识"
              />
              <input
                className="input input-bordered rounded-xl"
                name="cover"
                placeholder="封面地址"
              />
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <select className="select select-bordered rounded-xl" name="reading_mode">
                <option value="chapters">站内章节阅读</option>
                <option value="document">本地文档阅读</option>
                <option value="external">外部网站阅读</option>
              </select>
              <input
                className="input input-bordered rounded-xl md:col-span-2"
                name="reading_url"
                placeholder="阅读地址：https://... 或 /uploads/..."
              />
            </div>
            <input
              className="input input-bordered rounded-xl"
              name="source_format"
              placeholder="来源格式，如 epub / txt / pdf / web"
            />
            <textarea
              className="textarea textarea-bordered rounded-xl"
              name="description"
              placeholder="简介"
            ></textarea>
            <div className="flex justify-end gap-2">
              <button className="ryu-btn-primary" type="submit">
                保存书籍
              </button>
            </div>
          </form>
          <div id="book-volume-editor" className="mt-5"></div>
        </section>
      </section>
    </section>
  );
}
