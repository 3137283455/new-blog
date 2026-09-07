export function BookmarkImportDialog() {
  return (
    <dialog id="bookmark-import-dialog" className="admin-media-picker admin-bookmark-import-dialog">
      <div className="admin-media-picker-panel admin-bookmark-import-panel">
        <header className="admin-bookmark-import-head">
          <div>
            <p>BOOKMARK IMPORT</p>
            <h3>校验并选择书签</h3>
            <span id="bookmark-import-file-name">尚未选择文件</span>
          </div>
          <button
            id="bookmark-import-close"
            className="admin-dialog-close"
            type="button"
            aria-label="关闭"
            title="关闭"
          >
            &times;
          </button>
        </header>
        <div
          id="bookmark-import-summary"
          className="admin-bookmark-import-summary"
          aria-live="polite"
        ></div>
        <div className="admin-bookmark-import-toolbar">
          <label>
            <span>筛选</span>
            <input
              id="bookmark-import-search"
              type="search"
              placeholder="搜索标题、网址或分类"
              autoComplete="off"
            />
          </label>
          <label>
            <span>状态</span>
            <select id="bookmark-import-status">
              <option value="all">全部</option>
              <option value="valid">可导入</option>
              <option value="invalid">有问题</option>
              <option value="selected">已选择</option>
            </select>
          </label>
          <button id="bookmark-import-select-visible" className="ryu-btn" type="button">
            选择当前
          </button>
          <button id="bookmark-import-clear-visible" className="ryu-btn" type="button">
            取消当前
          </button>
        </div>
        <div className="admin-bookmark-import-columns" aria-hidden="true">
          <span>选择</span>
          <span>书签</span>
          <span>分类</span>
          <span>校验结果</span>
        </div>
        <div id="bookmark-import-list" className="admin-bookmark-import-list"></div>
        <footer className="admin-bookmark-import-actions">
          <p id="bookmark-import-message">只有通过校验且被选中的书签会写入导航。</p>
          <div>
            <button id="bookmark-import-cancel" className="ryu-btn" type="button">
              取消
            </button>
            <button id="bookmark-import-confirm" className="ryu-btn-primary" type="button">
              导入所选
            </button>
          </div>
        </footer>
      </div>
    </dialog>
  );
}
