export function BangumiPlaySourceDialog() {
  return (
    <dialog
      id="bangumi-play-source-dialog"
      className="admin-media-picker bangumi-play-source-dialog"
    >
      <form id="bangumi-play-source-form" className="admin-media-picker-panel" method="dialog">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 id="bangumi-play-source-title" className="text-xl font-black">
              新增播放源
            </h3>
            <p className="text-sm text-base-content/50">填写平台名称与可访问的播放地址。</p>
          </div>
          <button
            id="bangumi-play-source-close"
            className="admin-dialog-close"
            type="button"
            aria-label="关闭"
            title="关闭"
          >
            &times;
          </button>
        </div>
        <input name="index" type="hidden" defaultValue="" />
        <div className="grid gap-3">
          <label className="grid gap-1.5">
            <span className="text-sm font-bold">播放源名称</span>
            <input
              className="input input-bordered rounded-xl"
              name="name"
              maxLength={60}
              placeholder="例如：Bilibili、AGE 动漫、WebDAV"
              required
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-sm font-bold">播放地址</span>
            <input
              className="input input-bordered rounded-xl"
              name="url"
              maxLength={500}
              type="url"
              placeholder="https://..."
              required
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-sm font-bold">备注</span>
            <input
              className="input input-bordered rounded-xl"
              name="remark"
              maxLength={120}
              placeholder="例如：1080P、需登录，可选"
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-sm font-bold">排序</span>
            <input
              className="input input-bordered rounded-xl"
              name="sort_order"
              type="number"
              min="-9999"
              max="9999"
              defaultValue="0"
            />
          </label>
          <label className="label cursor-pointer justify-start gap-3">
            <input className="checkbox" name="is_default" type="checkbox" />
            <span>设为默认播放源</span>
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button className="ryu-btn" type="button" data-close-play-source>
            取消
          </button>
          <button className="ryu-btn-primary" type="submit">
            保存播放源
          </button>
        </div>
      </form>
    </dialog>
  );
}
