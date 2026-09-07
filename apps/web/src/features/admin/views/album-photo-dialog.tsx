export function AlbumPhotoDialog() {
  return (
    <dialog id="album-photo-dialog" className="admin-media-picker">
      <div className="admin-media-picker-panel">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 id="album-photo-dialog-title" className="text-xl font-black">
            照片信息
          </h3>
          <button
            id="album-photo-dialog-close"
            className="admin-dialog-close"
            type="button"
            aria-label="关闭"
            title="关闭"
          >
            &times;
          </button>
        </div>
        <div id="album-photo-form-host"></div>
      </div>
    </dialog>
  );
}
