export function MusicTrackDialog() {
  return (
    <dialog id="music-track-dialog" className="admin-media-picker admin-music-form-dialog">
      <div className="admin-media-picker-panel">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 id="music-track-dialog-title" className="text-xl font-black">
              新增歌曲
            </h3>
            <p className="text-sm text-base-content/50">支持上传音频、封面并填写 LRC 歌词。</p>
          </div>
          <button
            id="music-track-dialog-close"
            className="admin-dialog-close"
            type="button"
            aria-label="关闭"
            title="关闭"
          >
            &times;
          </button>
        </div>
        <form id="music-form" className="grid gap-4">
          <label className="form-control">
            <span className="label-text">歌曲名</span>
            <input className="input input-bordered rounded-xl" name="title" required />
          </label>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="form-control">
              <span className="label-text">歌手</span>
              <input
                className="input input-bordered rounded-xl"
                name="artist"
                placeholder="未知歌手"
              />
            </label>
            <label className="form-control">
              <span className="label-text">所属歌单</span>
              <select
                className="select select-bordered rounded-xl"
                name="playlist"
                required
              ></select>
            </label>
          </div>
          <label className="form-control">
            <span className="label-text">音乐地址</span>
            <div className="join w-full">
              <input
                className="input join-item input-bordered w-full rounded-l-xl"
                name="url"
                placeholder="/uploads/..."
                required
              />
              <button
                className="btn join-item"
                type="button"
                data-pick-media
                data-target-form="music-form"
                data-target-field="url"
                data-media-type="audio"
              >
                选择
              </button>
              <label className="btn join-item rounded-r-xl">
                上传
                <input id="music-audio-upload" className="hidden" type="file" accept="audio/*" />
              </label>
            </div>
          </label>
          <label className="form-control">
            <span className="label-text">封面地址</span>
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
                data-target-form="music-form"
                data-target-field="cover"
                data-media-type="image"
              >
                选择
              </button>
              <label className="btn join-item rounded-r-xl">
                上传
                <input id="music-cover-upload" className="hidden" type="file" accept="image/*" />
              </label>
            </div>
          </label>
          <label className="form-control">
            <span className="label-text">歌词</span>
            <textarea
              className="textarea textarea-bordered min-h-36 rounded-xl"
              name="lyrics"
              placeholder="支持逐行歌词，也可以粘贴 LRC 文本"
            ></textarea>
          </label>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="form-control">
              <span className="label-text">关联文章 ID</span>
              <input
                className="input input-bordered rounded-xl"
                name="article_id"
                type="number"
                min="1"
                placeholder="可选"
              />
            </label>
            <label className="form-control">
              <span className="label-text">关联照片 ID</span>
              <input
                className="input input-bordered rounded-xl"
                name="photo_id"
                type="number"
                min="1"
                placeholder="可选"
              />
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <button id="cancel-music-track" className="ryu-btn" type="button">
              取消
            </button>
            <button className="ryu-btn-primary" type="submit">
              保存歌曲
            </button>
          </div>
        </form>
      </div>
    </dialog>
  );
}
