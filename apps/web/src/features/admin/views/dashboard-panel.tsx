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
