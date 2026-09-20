export function ContentCenterPanel() {
  return (
    <section id="content-center-panel" className="admin-panel hidden">
      <div className="grid gap-5">
        <header className="flex flex-wrap items-end justify-between gap-3 px-1">
          <div>
            <p className="text-xs font-black tracking-[.18em] text-primary">PERSONAL CONTENT HUB</p>
            <h2 className="mt-1 text-2xl font-black">导入与关系</h2>
            <p className="text-sm text-base-content/50">
              导入内容、整理更新订阅，建立内容之间的关联。
            </p>
          </div>
          <a className="ryu-btn btn-sm" href="/reading">
            继续阅读 ↗
          </a>
        </header>
        <nav className="admin-content-sections" aria-label="导入与关系工作区">
          <button type="button" data-content-section="import" aria-pressed="true">
            文件导入
          </button>
          <button type="button" data-content-section="subscriptions" aria-pressed="false">
            更新订阅
          </button>
          <button type="button" data-content-section="relations" aria-pressed="false">
            内容关系
          </button>
        </nav>
        <section className="ryu-card p-5" data-content-view="import">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <div>
              <h3 className="text-xl font-black">图书与媒体导入</h3>
              <p className="mt-1 text-sm text-base-content/50">
                支持 EPUB、TXT、Markdown、PDF 和普通图片、音视频；漫画文件不再从后台导入。
              </p>
              <label
                id="content-import-drop"
                className="mt-4 grid min-h-40 cursor-pointer place-items-center rounded-2xl border border-dashed border-base-content/20 bg-base-200/35 p-6 text-center"
              >
                <span>
                  <b className="block text-lg">拖入文件或点击选择</b>
                  <small className="mt-2 block text-base-content/45">
                    可多选；EPUB 统一作为图书处理
                  </small>
                </span>
                <input
                  id="content-import-files"
                  className="hidden"
                  type="file"
                  multiple
                  accept=".epub,.txt,.md,.markdown,.pdf,.jpg,.jpeg,.png,.webp,.gif,.avif,.bmp,image/*,audio/*,video/*"
                />
              </label>
              <div id="content-import-queue" className="mt-3 grid gap-2"></div>
              <div className="mt-3 flex flex-wrap justify-end gap-2">
                <button id="content-import-clear" className="ryu-btn" type="button">
                  清空
                </button>
                <button id="content-import-start" className="ryu-btn-primary" type="button">
                  开始处理
                </button>
              </div>
            </div>
            <aside>
              <h4 className="font-black">最近任务</h4>
              <p className="mt-1 text-xs text-base-content/45">只保留最新 4 条，旧记录会自动清理。</p>
              <div id="content-import-jobs" className="mt-3 grid gap-2 text-sm"></div>
            </aside>
          </div>
        </section>
        <div className="admin-content-secondary">
          <section className="ryu-card p-5" data-content-view="subscriptions" hidden>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-black">更新订阅</h3>
                <p className="text-sm text-base-content/50">系统会读取订阅地址并比较最新内容；检测到变化后自动增加未读数。</p>
              </div>
              <button id="content-subscriptions-check" className="ryu-btn" type="button">
                检查全部更新
              </button>
            </div>
            <form
              id="content-subscription-form"
              className="mt-4 grid gap-2 sm:grid-cols-[7rem_1fr]"
            >
              <select className="select select-bordered rounded-xl" name="kind">
                <option value="book">小说</option>
                <option value="manga">漫画</option>
                <option value="bangumi">番剧</option>
                <option value="web">网页</option>
              </select>
              <input
                className="input input-bordered rounded-xl"
                name="title"
                placeholder="订阅名称"
                required
              />
              <input
                className="input input-bordered rounded-xl sm:col-span-2"
                name="url"
                type="url"
                placeholder="https://..."
                required
              />
              <button className="ryu-btn-primary sm:col-span-2" type="submit">
                添加订阅
              </button>
            </form>
            <div id="content-subscriptions" className="mt-4 grid gap-2"></div>
          </section>
          <section className="ryu-card p-5" data-content-view="relations" hidden>
            <div>
              <h3 className="text-xl font-black">内容关系</h3>
              <p className="text-sm text-base-content/50">
                选择一篇文章或一本相册作为展示页，再指定要推荐的内容；保存后会出现在该详情页底部。
              </p>
            </div>
            <form id="content-relation-form" className="mt-4 grid grid-cols-[7rem_1fr] gap-2">
              <select className="select select-bordered rounded-xl" name="source_type">
                <option value="article">文章</option>
                <option value="album">相册</option>
              </select>
              <select className="select select-bordered rounded-xl" name="source_id" required>
                <option value="">选择来源内容</option>
              </select>
              <select className="select select-bordered rounded-xl" name="target_type">
                <option value="article">文章</option>
                <option value="page">页面</option>
                <option value="book">书籍</option>
                <option value="manga">漫画</option>
                <option value="bangumi">番剧</option>
                <option value="album">相册</option>
                <option value="music">音乐</option>
                <option value="series">专题</option>
              </select>
              <select className="select select-bordered rounded-xl" name="target_id" required>
                <option value="">选择目标内容</option>
              </select>
              <select className="select select-bordered rounded-xl" name="relation_type">
                <option value="related">相关内容</option>
                <option value="review">观后感</option>
                <option value="adaptation">改编作品</option>
                <option value="soundtrack">背景音乐</option>
              </select>
              <input
                className="input input-bordered rounded-xl"
                name="note"
                placeholder="备注（可选）"
              />
              <button className="ryu-btn-primary col-span-2" type="submit">
                建立并显示到前台
              </button>
            </form>
            <div id="content-relations" className="mt-4 grid gap-2"></div>
          </section>
        </div>
      </div>
    </section>
  );
}
