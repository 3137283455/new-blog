export function NavigationDialog() {
  return (
    <dialog id="navigation-dialog" className="admin-media-picker">
      <div className="admin-media-picker-panel">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 id="navigation-dialog-title" className="text-xl font-black">
            新增导航
          </h3>
          <button
            id="navigation-dialog-close"
            className="admin-dialog-close"
            type="button"
            aria-label="关闭"
            title="关闭"
          >
            &times;
          </button>
        </div>
        <div id="navigation-form-host"></div>
      </div>
    </dialog>
  );
}
