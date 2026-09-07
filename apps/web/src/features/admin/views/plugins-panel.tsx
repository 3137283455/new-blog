export function PluginsPanel() {
  return (
    <section id="plugins-panel" className="admin-panel hidden">
      <div className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
        <form id="plugin-form" className="ryu-card grid gap-4 p-5">
          <div>
            <h2 className="text-2xl font-black">安装插件</h2>
            <p className="text-sm text-base-content/50">支持自定义插件登记、启用和停用。</p>
          </div>
          <input
            className="input input-bordered rounded-xl"
            name="id"
            placeholder="插件 ID，如 reading-progress"
            required
          />
          <input
            className="input input-bordered rounded-xl"
            name="name"
            placeholder="插件名称"
            required
          />
          <textarea
            className="textarea textarea-bordered rounded-xl"
            name="description"
            placeholder="插件描述"
          ></textarea>
          <button className="ryu-btn-primary" type="submit">
            安装插件
          </button>
          <p id="plugin-message" className="min-h-6 text-sm"></p>
        </form>
        <div className="ryu-card p-5">
          <h3 className="text-xl font-black">插件列表</h3>
          <div id="plugins-list" className="mt-4 grid gap-3"></div>
        </div>
      </div>
    </section>
  );
}
