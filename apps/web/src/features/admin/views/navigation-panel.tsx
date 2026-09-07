export function NavigationPanel() {
  return (
    <section id="navigation-panel" className="admin-panel hidden">
      <section className="ryu-card mb-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-black">搜索引擎</h2>
            <p className="text-sm text-base-content/50">
              管理导航首页搜索栏里的来源；地址使用 <code>&#123;query&#125;</code>{' '}
              作为关键词占位符，站内搜索填写 <code>site:</code>。
            </p>
          </div>
          <span className="badge badge-outline">最多 16 个</span>
        </div>
        <form
          id="search-engine-form"
          className="mt-4 grid gap-3 lg:grid-cols-[minmax(8rem,0.7fr)_6rem_minmax(16rem,1.7fr)_auto]"
        >
          <input
            className="input input-bordered rounded-xl"
            name="name"
            maxLength={30}
            placeholder="名称，如 Bing"
            required
          />
          <input
            className="input input-bordered rounded-xl"
            name="mark"
            maxLength={4}
            placeholder="图标，如 B"
          />
          <input
            className="input input-bordered rounded-xl"
            name="url"
            maxLength={500}
            placeholder="https://www.bing.com/search?q={query}"
            required
          />
          <button className="ryu-btn-primary" type="submit">
            添加来源
          </button>
        </form>
        <p id="search-engine-message" className="mt-2 min-h-5 text-sm" aria-live="polite"></p>
        <div
          id="search-engine-list"
          className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3"
        ></div>
      </section>
      <div className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
        <form id="navigation-form" className="ryu-card grid gap-4 p-5">
          <input type="hidden" name="id" />
          <div>
            <h2 className="text-2xl font-black">导航管理</h2>
            <p className="text-sm text-base-content/50">管理前台「导航」页面的分类资源卡。</p>
          </div>
          <input
            className="input input-bordered rounded-xl"
            name="title"
            maxLength={80}
            placeholder="标题"
            required
          />
          <input
            className="input input-bordered rounded-xl"
            name="url"
            maxLength={500}
            placeholder="链接地址"
            required
          />
          <input
            className="input input-bordered rounded-xl"
            name="category"
            maxLength={40}
            placeholder="分类，如 工具 / 设计 / 站点"
          />
          <select className="select select-bordered rounded-xl" name="workspace">
            <option value="general">通用布局</option>
            <option value="work">工作布局</option>
            <option value="study">学习布局</option>
            <option value="fun">娱乐布局</option>
          </select>
          <input
            className="input input-bordered rounded-xl"
            name="icon"
            maxLength={40}
            placeholder="图标字符，如 ◎ / ☆ / GitHub"
          />
          <div className="join w-full">
            <input
              className="input join-item input-bordered w-full rounded-l-xl"
              name="avatar"
              maxLength={500}
              placeholder="图片地址 /uploads/..."
            />
            <button
              className="btn join-item"
              type="button"
              data-pick-media
              data-target-form="navigation-form"
              data-target-field="avatar"
              data-media-type="image"
            >
              选择
            </button>
            <label className="btn join-item rounded-r-xl">
              上传
              <input
                id="navigation-avatar-upload"
                className="hidden"
                type="file"
                accept="image/*"
              />
            </label>
          </div>
          <input
            className="input input-bordered rounded-xl"
            name="sort_order"
            type="number"
            min="-9999"
            max="9999"
            placeholder="排序"
          />
          <textarea
            className="textarea textarea-bordered rounded-xl"
            name="description"
            maxLength={300}
            placeholder="描述"
          ></textarea>
          <label className="label cursor-pointer justify-start gap-3">
            <input className="checkbox" name="is_active" type="checkbox" defaultChecked />
            前台显示
          </label>
          <div className="flex gap-2">
            <button className="ryu-btn-primary" type="submit">
              保存导航
            </button>
            <button className="ryu-btn" type="button" data-reset-extra="navigation">
              清空
            </button>
          </div>
          <p id="navigation-message" className="min-h-6 text-sm"></p>
        </form>
        <div className="ryu-card p-5">
          <h3 className="text-xl font-black">导航列表</h3>
          <div id="navigation-list" className="mt-4 grid gap-3"></div>
        </div>
      </div>
    </section>
  );
}
