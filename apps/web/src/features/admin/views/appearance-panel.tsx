export function AppearancePanel() {
  return (
    <section id="appearance-panel" className="admin-panel hidden">
      <header className="admin-feature-heading">
        <div>
          <p>APPEARANCE</p>
          <h2>主题外观</h2>
          <span>这里直接管理前台右上角的三种外观，不再维护另一套主题。</span>
        </div>
        <a className="ryu-btn" href="/" target="_blank" rel="noreferrer">打开前台 ↗</a>
      </header>
      <div className="admin-theme-layout">
        <form id="theme-form" className="ryu-card admin-theme-editor">
          <input name="editing_id" type="hidden" />
          <input name="author" type="hidden" defaultValue="Boke" />
          <header>
            <div>
              <h3 id="theme-form-title">编辑前台外观</h3>
              <p id="theme-form-description">从右侧选择纸张绿、深海蓝或霓虹紫。</p>
            </div>
            <button id="theme-reset" className="ryu-btn btn-sm" type="button">重新载入</button>
          </header>
          <div className="admin-theme-fields two-columns">
            <label><span>前台外观标识</span><input className="input input-bordered" name="id" readOnly /></label>
            <label><span>菜单名称</span><input className="input input-bordered" name="name" required /></label>
          </div>
          <div className="admin-theme-fields color-fields">
            <label><span>主色</span><input name="primary" type="color" defaultValue="#2f6f4e" /></label>
            <label><span>悬停色</span><input name="primary_hover" type="color" defaultValue="#245a3e" /></label>
            <label><span>浅色背景</span><input name="primary_light" type="color" defaultValue="#dcefe3" /></label>
          </div>
          <div className="admin-theme-preview" id="theme-live-preview">
            <span>LIVE PREVIEW</span>
            <strong id="theme-preview-name">前台外观</strong>
            <p>保存后，前台对应外观的颜色、圆角、宽度与字体会同步更新。</p>
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
          <div className="admin-theme-fields">
            <label><span>外观说明</span><input className="input input-bordered" name="description" placeholder="这套外观的用途" /></label>
          </div>
          <footer>
            <p id="theme-message" className="min-h-6 text-sm"></p>
            <button id="theme-submit" className="ryu-btn-primary" type="submit">保存到前台</button>
          </footer>
        </form>
        <section className="ryu-card admin-theme-library">
          <header><div><h3>前台外观选项</h3><p>与前台右上角菜单一一对应；“默认”只影响尚未手动选择的访客。</p></div></header>
          <div id="themes-list" className="grid gap-3"></div>
        </section>
      </div>
    </section>
  );
}
