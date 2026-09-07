export function MangaSettingsDialog() {
  return (
    <dialog id="manga-settings-dialog" className="admin-media-picker">
      <form id="manga-settings-form" className="admin-media-picker-panel" method="dialog">
        <input name="id" type="hidden" />
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black tracking-[.18em] text-primary">MANGA · SETTINGS</p>
            <h3 id="manga-settings-title" className="mt-1 text-xl font-black">
              漫画基础设置
            </h3>
            <p id="manga-settings-meta" className="mt-1 text-sm text-base-content/50"></p>
          </div>
          <button
            id="manga-settings-close"
            className="admin-dialog-close"
            type="button"
            aria-label="关闭"
            title="关闭"
          >
            &times;
          </button>
        </div>
        <div className="mt-5 grid gap-4">
          <label className="grid gap-1">
            <span className="text-xs font-black text-base-content/60">阅读状态</span>
            <select name="status" className="select select-bordered rounded-xl">
              <option value="reading">在读</option>
              <option value="planned">想读</option>
              <option value="finished">读完</option>
              <option value="paused">暂放</option>
            </select>
          </label>
          <label className="grid gap-1">
            <span className="text-xs font-black text-base-content/60">显示顺序</span>
            <input
              name="sort_order"
              className="input input-bordered rounded-xl"
              type="number"
              min="-9999"
              max="9999"
            />
          </label>
          <label className="label cursor-pointer justify-start gap-3 rounded-xl bg-base-200/45 px-4">
            <input name="is_active" className="checkbox" type="checkbox" />
            前台显示
          </label>
        </div>
        <div className="mt-5 flex items-center justify-between gap-3">
          <p id="manga-settings-message" className="min-h-6 text-sm"></p>
          <div className="flex gap-2">
            <button id="manga-settings-cancel" className="ryu-btn" type="button">
              取消
            </button>
            <button className="ryu-btn-primary" type="submit">
              保存设置
            </button>
          </div>
        </div>
      </form>
    </dialog>
  );
}
