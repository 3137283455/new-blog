export function MusicPlaylistDialog() {
  return (
    <dialog id="music-playlist-dialog" className="admin-media-picker admin-music-form-dialog">
      <div className="admin-media-picker-panel">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 id="music-playlist-dialog-title" className="text-xl font-black">
              新建歌单
            </h3>
            <p className="text-sm text-base-content/50">设置歌单名称、封面与前台状态。</p>
          </div>
          <button
            id="music-playlist-dialog-close"
            className="admin-dialog-close"
            type="button"
            aria-label="关闭"
            title="关闭"
          >
            &times;
          </button>
        </div>
        <form id="music-playlist-form" className="grid gap-3">
          <input type="hidden" name="id" />
          <label className="form-control">
            <span className="label-text">歌单名称</span>
            <input
              className="input input-bordered rounded-xl"
              name="name"
              placeholder="歌单名称"
              required
            />
          </label>
          <label className="form-control">
            <span className="label-text">歌单描述</span>
            <input
              className="input input-bordered rounded-xl"
              name="description"
              placeholder="简要介绍这个歌单"
            />
          </label>
          <label className="form-control">
            <span className="label-text">歌单封面</span>
            <div className="join w-full">
              <input
                className="input join-item input-bordered w-full rounded-l-xl"
                name="cover"
                placeholder="/uploads/..."
              />
              <button
                className="btn join-item"
                type="button"
                data-pick-media
                data-target-form="music-playlist-form"
                data-target-field="cover"
                data-media-type="image"
              >
                选择
              </button>
              <label className="btn join-item rounded-r-xl">
                上传
                <input
                  id="music-playlist-cover-upload"
                  className="hidden"
                  type="file"
                  accept="image/*"
                />
              </label>
            </div>
          </label>
          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
            <label className="form-control">
              <span className="label-text">排序</span>
              <input
                className="input input-bordered rounded-xl"
                name="sort_order"
                type="number"
                placeholder="0"
              />
            </label>
            <label className="label mt-6 cursor-pointer justify-start gap-2 rounded-xl bg-base-100/60 px-3">
              <input
                className="checkbox checkbox-sm"
                name="is_active"
                type="checkbox"
                defaultChecked
              />
              前台启用
            </label>
          </div>
          <div className="mt-2 flex justify-end gap-2">
            <button className="ryu-btn" id="cancel-music-playlist" type="button">
              取消
            </button>
            <button className="ryu-btn-primary" type="submit">
              保存歌单
            </button>
          </div>
          <p id="music-playlist-message" className="min-h-6 text-sm"></p>
        </form>
      </div>
    </dialog>
  );
}
