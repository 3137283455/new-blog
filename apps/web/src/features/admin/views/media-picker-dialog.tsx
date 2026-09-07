export function MediaPickerDialog() {
  return (
    <dialog id="media-picker-dialog" className="admin-media-picker">
      <div className="admin-media-picker-panel">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-xl font-black">选择媒体资源</h3>
            <p id="media-picker-hint" className="text-sm text-base-content/50">
              从媒体库选择已上传文件。
            </p>
          </div>
          <button
            id="close-media-picker"
            className="admin-dialog-close"
            type="button"
            aria-label="关闭"
            title="关闭"
          >
            &times;
          </button>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_10rem]">
          <input
            id="media-picker-search"
            className="input input-bordered rounded-xl"
            type="search"
            placeholder="搜索文件名、路径、类型..."
          />
          <select id="media-picker-type" className="select select-bordered rounded-xl">
            <option value="">全部类型</option>
            <option value="image">图片</option>
            <option value="audio">音频</option>
            <option value="video">视频</option>
          </select>
        </div>
        <div id="media-picker-grid" className="admin-media-picker-grid mt-4"></div>
      </div>
    </dialog>
  );
}
