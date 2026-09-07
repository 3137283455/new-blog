export function AppearancePanel() {
  return (
    <section id="appearance-panel" className="admin-panel hidden">
      <div className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
        <form id="theme-form" className="ryu-card grid gap-4 p-5">
          <div>
            <h2 className="text-2xl font-black">安装主题</h2>
            <p className="text-sm text-base-content/50">当前支持颜色主题一键安装、预览和切换。</p>
          </div>
          <input
            className="input input-bordered rounded-xl"
            name="id"
            placeholder="主题 ID，如 ocean-soft"
            required
          />
          <input
            className="input input-bordered rounded-xl"
            name="name"
            placeholder="主题名称"
            required
          />
          <input
            className="input input-bordered rounded-xl"
            name="primary"
            type="color"
            defaultValue="#3b82f6"
            required
          />
          <input className="input input-bordered rounded-xl" name="author" placeholder="作者" />
          <textarea
            className="textarea textarea-bordered rounded-xl"
            name="description"
            placeholder="主题描述"
          ></textarea>
          <button className="ryu-btn-primary" type="submit">
            安装主题
          </button>
          <p id="theme-message" className="min-h-6 text-sm"></p>
        </form>
        <div className="ryu-card p-5">
          <h3 className="text-xl font-black">主题列表</h3>
          <div id="themes-list" className="mt-4 grid gap-3"></div>
        </div>
      </div>
    </section>
  );
}
