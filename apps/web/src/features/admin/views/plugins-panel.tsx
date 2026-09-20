export function PluginsPanel() {
  return (
    <section id="plugins-panel" className="admin-panel hidden">
      <header className="admin-feature-heading">
        <div>
          <p>FRONTEND FEATURES</p>
          <h2>前台功能开关</h2>
          <span>这里只显示已经接入前台的内置功能；启用或停用后，刷新文章页即可生效。</span>
        </div>
        <a className="ryu-btn" href="/archive" target="_blank" rel="noreferrer">查看文章 ↗</a>
      </header>
      <section className="ryu-card admin-plugin-library">
        <div className="admin-plugin-note">
          <strong>这些不是占位插件</strong>
          <span>每个开关都对应一项真实的文章阅读功能。暂不支持安装任意名称但没有代码的“插件”。</span>
        </div>
        <div id="plugins-list" className="admin-plugin-grid"></div>
      </section>
    </section>
  );
}
