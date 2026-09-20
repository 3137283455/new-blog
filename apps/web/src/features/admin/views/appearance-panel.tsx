export function AppearancePanel() {
  return (
    <section id="appearance-panel" className="admin-panel hidden">
      <header className="admin-feature-heading">
        <div>
          <p>APPEARANCE</p>
          <h2>主题外观</h2>
          <span>调整后会真实作用于前台的颜色、字体、卡片与内容宽度。</span>
        </div>
        <a className="ryu-btn" href="/" target="_blank" rel="noreferrer">打开前台 ↗</a>
      </header>
      <div className="admin-theme-layout">
        <form id="theme-form" className="ryu-card admin-theme-editor">
          <input name="editing_id" type="hidden" />
          <header>
            <div>
              <h3 id="theme-form-title">创建个人主题</h3>
              <p id="theme-form-description">创建后可在右侧启用，也可以随时重新编辑。</p>
            </div>
            <button id="theme-reset" className="ryu-btn btn-sm" type="button">新建</button>
          </header>
          <div className="admin-theme-fields two-columns">
            <label><span>主题 ID</span><input className="input input-bordered" name="id" placeholder="例如 ocean-soft" required /></label>
            <label><span>主题名称</span><input className="input input-bordered" name="name" placeholder="例如 海风" required /></label>
          </div>
          <div className="admin-theme-fields color-fields">
            <label><span>主色</span><input name="primary" type="color" defaultValue="#2f6f4e" /></label>
            <label><span>悬停色</span><input name="primary_hover" type="color" defaultValue="#245a3e" /></label>
            <label><span>浅色背景</span><input name="primary_light" type="color" defaultValue="#dcefe3" /></label>
          </div>
          <div className="admin-theme-preview" id="theme-live-preview">
            <span>LIVE PREVIEW</span>
            <strong id="theme-preview-name">个人主题</strong>
            <p>颜色、圆角、透明度与字体会在这里即时预览。</p>
            <button type="button">示例按钮</button>
          </div>
          <div className="admin-theme-fields two-columns">
            <label><span>正文字体</span><input className="input input-bordered" name="body_font" defaultValue="system-ui" placeholder="system-ui" /></label>
            <label><span>标题字体</span><input className="input input-bordered" name="title_font" defaultValue="Georgia, serif" placeholder="Georgia, serif" /></label>
            <label><span>卡片圆角</span><input className="input input-bordered" name="card_radius" type="number" min="0" max="40" defaultValue="18" /><small>0–40 px</small></label>
            <label><span>卡片透明度</span><input className="input input-bordered" name="card_opacity" type="number" min="0.35" max="1" step="0.05" defaultValue="0.86" /><small>0.35–1</small></label>
            <label><span>内容宽度</span><input className="input input-bordered" name="content_width" type="number" min="48" max="96" defaultValue="72" /><small>48–96 rem</small></label>
            <label><span>季节标记</span><select className="select select-bordered" name="season" defaultValue="custom"><option value="custom">自定义</option><option value="spring">春</option><option value="summer">夏</option><option value="autumn">秋</option><option value="winter">冬</option></select></label>
          </div>
          <div className="admin-theme-fields two-columns">
            <label><span>作者</span><input className="input input-bordered" name="author" placeholder="个人主题" /></label>
            <label><span>说明</span><input className="input input-bordered" name="description" placeholder="这套主题的用途" /></label>
          </div>
          <footer>
            <p id="theme-message" className="min-h-6 text-sm"></p>
            <button id="theme-submit" className="ryu-btn-primary" type="submit">创建主题</button>
          </footer>
        </form>
        <section className="ryu-card admin-theme-library">
          <header><div><h3>已保存主题</h3><p>启用后刷新前台即可看到完整效果。</p></div></header>
          <div id="themes-list" className="grid gap-3"></div>
        </section>
      </div>
    </section>
  );
}
