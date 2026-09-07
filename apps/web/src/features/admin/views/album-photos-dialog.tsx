export function AlbumPhotosDialog() {
  return (
    <dialog id="album-photos-dialog" className="admin-media-picker admin-album-photos-dialog">
      <div className="admin-media-picker-panel">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 id="album-photos-title" className="text-xl font-black">
              相册照片
            </h3>
            <p id="album-photos-meta" className="text-sm text-base-content/50"></p>
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="ryu-btn-primary btn-sm cursor-pointer">
              上传图片
              <input id="album-photo-bulk-upload" className="hidden" type="file" accept="image/*" />
            </label>
            <button id="album-photo-create" className="ryu-btn btn-sm" type="button">
              从媒体库导入
            </button>
            <button
              id="album-photos-close"
              className="admin-dialog-close"
              type="button"
              aria-label="关闭"
              title="关闭"
            >
              &times;
            </button>
          </div>
        </div>
        <div id="album-photos-grid" className="admin-photo-grid mt-5"></div>
      </div>
    </dialog>
  );
}
