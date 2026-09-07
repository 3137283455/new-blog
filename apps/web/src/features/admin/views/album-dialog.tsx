export function AlbumDialog() {
  return (
    <dialog id="album-dialog" className="admin-media-picker">
      <div className="admin-media-picker-panel">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 id="album-dialog-title" className="text-xl font-black">
            新建相册
          </h3>
          <button
            id="album-dialog-close"
            className="admin-dialog-close"
            type="button"
            aria-label="关闭"
            title="关闭"
          >
            &times;
          </button>
        </div>
        <div id="album-form-host"></div>
      </div>
    </dialog>
  );
}
