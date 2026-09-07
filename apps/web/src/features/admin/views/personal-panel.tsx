export function PersonalPanel() {
  return (
    <section id="personal-panel" className="admin-panel hidden">
      <header className="admin-personal-hero">
        <div>
          <p>PERSONAL WORKSPACE</p>
          <h2>个人博客长期中心</h2>
          <span>统一整理灵感、待办、年度记录、主题外观与私人设备。</span>
        </div>
        <a className="ryu-btn" href="/memories" target="_blank">
          查看年度回顾 ↗
        </a>
      </header>
      <nav className="admin-personal-tabs">
        <button className="is-active" type="button" data-personal-tab="inbox">
          稍后处理
        </button>
        <button type="button" data-personal-tab="report">
          写作报告
        </button>
        <button type="button" data-personal-tab="theme">
          主题编辑器
        </button>
        <button type="button" data-personal-tab="devices">
          设备同步
        </button>
      </nav>

      <div className="admin-personal-section" data-personal-section="inbox">
        <div className="admin-personal-columns">
          <section className="ryu-card p-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black">灵感收集箱</h3>
                <p className="text-sm text-base-content/50">首页记录会自动同步到这里。</p>
              </div>
              <select
                id="personal-inbox-filter"
                className="select select-bordered select-sm rounded-xl"
              >
                <option value="all">全部</option>
                <option value="pending">待处理</option>
                <option value="done">已转换</option>
              </select>
            </div>
            <div id="personal-inbox-list" className="admin-personal-list mt-4"></div>
          </section>
          <section className="ryu-card p-5">
            <h3 className="text-xl font-black">个人待办</h3>
            <p className="text-sm text-base-content/50">由收集箱转换而来，可在这里完成或删除。</p>
            <div id="personal-todo-list" className="admin-personal-list mt-4"></div>
          </section>
        </div>
      </div>

      <div className="admin-personal-section hidden" data-personal-section="report">
        <section className="ryu-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-black">年度写作报告</h3>
              <p className="text-sm text-base-content/50">文章发布、字数、阅读与连续写作统计。</p>
            </div>
            <select
              id="personal-report-year"
              className="select select-bordered rounded-xl"
            ></select>
          </div>
          <div id="personal-report-stats" className="admin-stats-grid mt-5"></div>
          <div id="personal-report-heatmap" className="memory-heatmap mt-5"></div>
          <div id="personal-report-months" className="admin-personal-months mt-5"></div>
        </section>
      </div>

      <div className="admin-personal-section hidden" data-personal-section="devices">
        <section className="ryu-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-black">私人设备与同步</h3>
              <p className="text-sm text-base-content/50">
                管理可同步导航、阅读进度、书签、高亮和私人笔记的设备。同一浏览器重复登记会更新原设备，不会新增重复项。
              </p>
            </div>
            <button id="register-current-device" className="ryu-btn btn-sm" type="button">
              重新登记当前设备
            </button>
          </div>
          <div id="private-device-list" className="admin-personal-list mt-4"></div>
        </section>
      </div>
      <div className="admin-personal-section hidden" data-personal-section="theme">
        <div className="admin-personal-columns">
          <form id="personal-theme-form" className="ryu-card grid gap-4 p-5">
            <div>
              <h3 className="text-xl font-black">可视化主题编辑器</h3>
              <p className="text-sm text-base-content/50">即时调整字体、圆角、透明度和页面宽度。</p>
            </div>
            <select
              id="personal-theme-select"
              className="select select-bordered rounded-xl"
              name="id"
            ></select>
            <label className="grid gap-1">
              <span className="text-sm font-bold">季节预设</span>
              <select className="select select-bordered rounded-xl" name="season">
                <option value="custom">自定义</option>
                <option value="spring">春日</option>
                <option value="summer">盛夏</option>
                <option value="autumn">秋色</option>
                <option value="winter">冬夜</option>
              </select>
            </label>
            <div className="grid grid-cols-3 gap-3">
              <label className="grid gap-1 text-xs">
                主色
                <input name="primary" type="color" defaultValue="#5e7c61" />
              </label>
              <label className="grid gap-1 text-xs">
                悬停色
                <input name="primary_hover" type="color" defaultValue="#456248" />
              </label>
              <label className="grid gap-1 text-xs">
                浅色
                <input name="primary_light" type="color" defaultValue="#dce8dc" />
              </label>
            </div>
            <label className="grid gap-1">
              <span className="text-sm font-bold">正文字体</span>
              <input
                className="input input-bordered rounded-xl"
                name="body_font"
                placeholder="system-ui"
              />
            </label>
            <label className="grid gap-1">
              <span className="text-sm font-bold">标题字体</span>
              <input
                className="input input-bordered rounded-xl"
                name="title_font"
                placeholder="Georgia, serif"
              />
            </label>
            <label className="grid gap-1">
              <span className="text-sm font-bold">
                卡片圆角 <b data-theme-value="card_radius">18</b>px
              </span>
              <input name="card_radius" type="range" min="0" max="40" defaultValue="18" />
            </label>
            <label className="grid gap-1">
              <span className="text-sm font-bold">
                卡片透明度 <b data-theme-value="card_opacity">86</b>%
              </span>
              <input name="card_opacity" type="range" min="35" max="100" defaultValue="86" />
            </label>
            <label className="grid gap-1">
              <span className="text-sm font-bold">
                页面宽度 <b data-theme-value="content_width">72</b>rem
              </span>
              <input name="content_width" type="range" min="48" max="96" defaultValue="72" />
            </label>
            <div className="flex flex-wrap gap-2">
              <button className="ryu-btn-primary" type="submit">
                保存配置
              </button>
              <button id="personal-theme-export" className="ryu-btn" type="button">
                导出
              </button>
              <label className="ryu-btn cursor-pointer">
                导入
                <input
                  id="personal-theme-import"
                  className="hidden"
                  type="file"
                  accept="application/json,.json"
                />
              </label>
            </div>
          </form>
          <section className="ryu-card p-5">
            <h3 className="text-xl font-black">实时预览</h3>
            <div id="personal-theme-preview" className="admin-theme-live-preview mt-4">
              <small>PERSONAL THEME</small>
              <h2>记录每个季节</h2>
              <p>字体、圆角、透明度与页面宽度会在保存后应用到整个前台。</p>
              <div>
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}
