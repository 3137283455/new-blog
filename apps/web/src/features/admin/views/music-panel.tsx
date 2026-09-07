export function MusicPanel() {
  return (
    <section id="music-panel" className="admin-panel hidden">
      <div className="ryu-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-black">歌单列表</h2>
            <p className="text-sm text-base-content/50">
              点击歌单管理歌曲，新增和修改均在弹窗中完成。
            </p>
          </div>
          <button className="ryu-btn-primary" type="button" id="reset-music-playlist">
            新建歌单
          </button>
        </div>
        <div id="music-playlist-list" className="admin-playlist-grid mt-5"></div>
      </div>
    </section>
  );
}
