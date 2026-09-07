export function SearchSourceConflictDialog() {
  return (
    <dialog id="search-source-conflict-dialog" className="admin-media-picker">
      <div className="admin-media-picker-panel max-w-lg">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-xl font-black">检索源已存在</h3>
            <p id="search-source-conflict-text" className="mt-1 text-sm text-base-content/55"></p>
          </div>
          <button
            id="search-source-conflict-cancel"
            className="admin-dialog-close"
            type="button"
            aria-label="关闭"
          >
            &times;
          </button>
        </div>
        <label className="mt-4 grid gap-1.5">
          <span className="text-xs font-black text-base-content/60">另存为新的源 ID</span>
          <input
            id="search-source-conflict-new-id"
            className="input input-bordered rounded-xl"
            maxLength={40}
            placeholder="例如 my-source-2"
          />
        </label>
        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          <button id="search-source-conflict-skip" className="ryu-btn" type="button">
            跳过
          </button>
          <button
            id="search-source-conflict-replace"
            className="btn btn-warning rounded-xl"
            type="button"
          >
            覆盖原源
          </button>
          <button id="search-source-conflict-rename" className="ryu-btn-primary" type="button">
            另存为
          </button>
        </div>
      </div>
    </dialog>
  );
}
