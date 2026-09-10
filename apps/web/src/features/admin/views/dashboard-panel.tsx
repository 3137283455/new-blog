export function DashboardPanel() {
  return (
    <section id="dashboard-panel" className="admin-panel hidden">
      <div className="admin-stats-grid">
        {[
          ['已发布', 'totalPosts'],
          ['草稿', 'draftPosts'],
          ['评论', 'totalComments'],
          ['阅读', 'totalViews'],
          ['分类', 'totalCategories'],
          ['媒体', 'totalMedia'],
          ['媒体回收站', 'trashedMedia'],
        ].map(([label, key]) => (
          <article className="ryu-card p-5" key={key}>
            <p className="text-sm text-base-content/50">{label}</p>
            <strong className="mt-2 block text-3xl" data-stat={key}>
              -
            </strong>
          </article>
        ))}
      </div>
      <section className="admin-storage-card ryu-card mt-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-base-content/45">全站存储配额</p>
            <h2 className="mt-1 text-2xl font-black">资源库 + 相册原图</h2>
            <p id="storage-summary" className="mt-1 text-sm text-base-content/55">正在读取空间使用情况…</p>
          </div>
          <a className="ryu-btn" href="#albums" id="storage-open-albums">管理相册导出</a>
        </div>
        <div className="admin-storage-layout mt-5">
          <div id="storage-pie" className="admin-storage-pie" aria-label="存储空间使用占比"><span>--</span></div>
          <div id="storage-breakdown" className="admin-storage-breakdown"></div>
          <form id="storage-settings-form" className="admin-storage-settings">
            <label>配额（GB）<input id="storage-quota-gb" className="input input-bordered" type="number" min="1" max="1024" step="0.1" /></label>
            <label>普通告警（%）<input id="storage-warn-percent" className="input input-bordered" type="number" min="1" max="98" /></label>
            <label>严重告警（%）<input id="storage-critical-percent" className="input input-bordered" type="number" min="2" max="100" /></label>
            <button className="ryu-btn-primary" type="submit">保存配额设置</button>
            <p id="storage-settings-message" className="min-h-5 text-sm"></p>
          </form>
        </div>
      </section>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="ryu-card p-5">
          <h3 className="font-black">最近发布</h3>
          <div id="recent-posts" className="mt-4 grid gap-3 text-sm"></div>
        </div>
        <div className="ryu-card p-5">
          <h3 className="font-black">系统提示</h3>
          <div id="admin-alerts" className="mt-4 grid gap-3 text-sm"></div>
        </div>
      </div>
      <div className="admin-dashboard-grid mt-4">
        <div className="ryu-card p-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-black">访问趋势</h3>
            <span className="text-xs text-base-content/45">近 30 天</span>
          </div>
          <div id="visit-chart" className="admin-bar-chart mt-4"></div>
        </div>
        <div className="ryu-card p-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-black">发布趋势</h3>
            <span className="text-xs text-base-content/45">近 30 天</span>
          </div>
          <div id="publish-chart" className="admin-bar-chart mt-4"></div>
        </div>
        <div className="ryu-card p-5">
          <h3 className="font-black">分类分布</h3>
          <div id="category-chart" className="admin-rank-chart mt-4"></div>
        </div>
        <div className="ryu-card p-5">
          <h3 className="font-black">热门文章</h3>
          <div id="popular-posts" className="mt-4 grid gap-3 text-sm"></div>
        </div>
      </div>
    </section>
  );
}
