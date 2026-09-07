export function MusicTracksDialog() {
  return (
    <dialog id="music-tracks-dialog" className="admin-media-picker admin-music-tracks-dialog">
      <div className="admin-media-picker-panel">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase text-primary">Playlist Tracks</p>
            <h3 id="music-tracks-dialog-title" className="text-xl font-black">
              歌单歌曲
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button id="create-music-track" className="ryu-btn-primary btn-sm" type="button">
              新增歌曲
            </button>
            <button
              id="music-tracks-dialog-close"
              className="admin-dialog-close"
              type="button"
              aria-label="关闭"
              title="关闭"
            >
              &times;
            </button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <span id="music-summary" className="text-sm text-base-content/55">
            0 首歌
          </span>
          <button id="save-music" className="ryu-btn btn-sm" type="button">
            保存排序
          </button>
        </div>
        <select id="music-playlist-filter" className="hidden" aria-hidden="true">
          <option value="">全部歌单</option>
        </select>
        <div id="music-list" className="admin-track-list mt-4"></div>
        <p id="music-message" className="mt-3 min-h-6 text-sm"></p>
      </div>
    </dialog>
  );
}
